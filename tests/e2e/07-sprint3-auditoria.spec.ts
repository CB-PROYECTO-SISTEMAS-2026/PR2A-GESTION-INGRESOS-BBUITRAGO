import { expect, test } from '@playwright/test';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { leerDatos, sesion } from './helpers/datos';
require('../integracion/helpers/entorno');

const db = new PrismaClient();
const esc = () => leerDatos().escenario;
const evento = () => esc().eventos.abierto;
const reporte = () => '/organizador/eventos/' + evento() + '/reportes';
test.afterAll(async () => db.$disconnect());

test('HU-035 admin consulta el reporte global', async ({browser})=>{
  const page=await browser.newPage({storageState:sesion('admin')});
  await page.goto('/admin/reportes');
  await expect(page.getByText('Ingreso neto por entradas')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Saldos pendientes'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Actividad por operador'})).toBeVisible();
  await page.close();
});
test('HU-036 organizador consulta solo su evento', async ({browser})=>{
  const page=await browser.newPage({storageState:sesion('organizador')});
  await page.goto(reporte());
  await expect(page.getByText('Ingreso neto por entradas')).toBeVisible();
  const dbEvento = await db.evento.findFirst({where:{organizadorId:esc().usuarios.organizador2}});
  if (dbEvento) {
    await page.goto('/organizador/eventos/'+dbEvento.id+'/reportes');
    await expect(page.getByRole('alert')).toContainText('Evento no encontrado');
  }
  await page.close();
});
test('HU-039 descarga CSV y Excel de ventas', async ({browser})=>{
  const page=await browser.newPage({storageState:sesion('organizador')});
  await page.goto(reporte());
  for (const formato of ['CSV','Excel']){
    const [archivo]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Descargar '+formato}).click()]);
    expect(archivo.suggestedFilename()).toMatch(formato==='CSV'?/\.csv$/:/\.xlsx$/);
    expect(await archivo.failure()).toBeNull();
  }
  await page.close();
});
test('HU-045 organizador reporta y admin resuelve una incidencia', async ({browser})=>{
  const texto='Incidencia QA '+randomUUID();
  const org=await browser.newPage({storageState:sesion('organizador')});
  await org.goto(reporte());
  await org.getByLabel('Descripción').fill(texto);
  await org.getByRole('button',{name:'Reportar incidencia'}).click();
  await expect(org.getByText(texto,{exact:true})).toBeVisible();
  const admin=await browser.newPage({storageState:sesion('admin')});
  await admin.goto('/admin/eventos/'+evento()+'/reportes');
  const fila=admin.locator('article').filter({hasText:texto});
  await fila.getByLabel('Resolución').fill('Resuelto durante la prueba');
  await fila.getByRole('button',{name:'Marcar resuelta'}).click();
  await expect(fila).toContainText('Resuelto durante la prueba');
  await org.reload();
  await expect(org.locator('article').filter({hasText:texto})).toContainText('Resuelta');
  await org.close();await admin.close();
});
test('HU-037 el dueño ve el ranking de sus ayudantes', async ({browser})=>{
  const page=await browser.newPage({storageState:sesion('jefe')});
  await page.goto('/negocio/dashboard');
  await expect(page.getByRole('heading',{name:'Desempeño por ayudante'})).toBeVisible();
  await expect(page.getByRole('row').filter({hasText:'Prueba ayudante Auto'})).toBeVisible();
  await page.close();
});
test('HU-021 el recargador reporta una recarga errónea', async ({browser})=>{
  const e=esc();
  const saldo=await db.saldoEvento.findUniqueOrThrow({where:{usuarioId_eventoId:{usuarioId:e.usuarios.cliente,eventoId:evento()}}});
  await db.transaccionSaldo.create({data:{saldoEventoId:saldo.id,usuarioId:saldo.usuarioId,eventoId:evento(),operadorId:e.usuarios.recargador,tipo:'RECARGA',monto:50,saldoResultante:saldo.saldo}});
  const page=await browser.newPage({storageState:sesion('recargador')});
  await page.goto('/recargas/historial');
  await page.getByRole('button',{name:/Reportar un problema/}).first().click();
  await page.locator('#tipo-incidencia').selectOption('MONTO_INCORRECTO');
  await page.locator('#descripcion-incidencia').fill('Monto de prueba incorrecto.');
  await page.getByRole('button',{name:'Reportar',exact:true}).click();
  await expect(page.getByText(/Problema reportado · en revisión/)).toBeVisible();
  await page.close();
});
test('HU-029 encargado ve solamente devoluciones propias', async ({browser})=>{
  const e=esc();
  const propio=await db.usuario.findUniqueOrThrow({where:{email:leerDatos().emails.devoluciones}});
  const saldo=await db.saldoEvento.findUniqueOrThrow({where:{usuarioId_eventoId:{usuarioId:e.usuarios.cliente,eventoId:evento()}}});
  await db.transaccionSaldo.createMany({data:[{operadorId:propio.id,monto:19.67},{operadorId:e.usuarios.recargador,monto:34.78}].map(d=>({...d,saldoEventoId:saldo.id,usuarioId:saldo.usuarioId,eventoId:evento(),tipo:'DEVOLUCION',saldoResultante:saldo.saldo}))});
  const page=await browser.newPage({storageState:sesion('devoluciones')});
  await page.goto('/devoluciones/historial');
  await expect(page.getByText(/19,67/)).toBeVisible();
  await expect(page.getByText(/34,78/)).toHaveCount(0);
  await page.close();
});
test('HU-048 muestra foto y movimientos, bloquea un titular sin foto', async ({browser})=>{
  const page=await browser.newPage({storageState:sesion('devoluciones')});
  await page.goto('/devoluciones');
  await page.getByRole('button',{name:/Escanear Manilla/}).click();
  await page.locator('#codigo-manual').fill(esc().codigos.qrCliente2);
  await page.getByRole('button',{name:'Buscar'}).click();
  await expect(page.getByText(/No se pueden devolver puntos sin la foto/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Devolver Saldo'})).toHaveCount(0);
  await page.close();
});
test('HU-044 cliente solicita, admin aprueba e invalida la entrada y registra efectivo', async ({browser})=>{
  const e=esc();
  const entrada=await db.entrada.findFirstOrThrow({where:{titularId:e.usuarios.cliente,eventoId:evento(),estado:'ASIGNADA',accesos:{none:{}}}});
  const compra=await db.compraEntrada.create({data:{usuarioId:e.usuarios.cliente,eventoId:evento(),estado:'APROBADA',reembolsoHasta:new Date(Date.now()-60000),montoTotal:33,items:{create:{categoriaId:entrada.categoriaId,precioUnit:33}}}});
  await db.entrada.update({where:{id:entrada.id},data:{compraId:compra.id}});
  try {
    const cli=await browser.newPage({storageState:sesion('cliente')});
    await cli.goto('/mis-reembolsos?entrada='+entrada.id);
    await cli.getByLabel('Motivo de devolución').fill('No asistiré a la prueba');
    await cli.getByRole('button',{name:'Solicitar reembolso'}).click();
    await expect(cli.getByRole('alert')).toContainText('Venció el plazo');
    await db.evento.update({where:{id:evento()},data:{estado:'CANCELADO'}});
    await cli.getByRole('button',{name:'Solicitar reembolso'}).click();
    await expect(cli.getByText('Solicitud registrada.')).toBeVisible();
    const admin=await browser.newPage({storageState:sesion('admin')});
    admin.on('dialog',d=>d.accept());
    await admin.goto('/admin/reembolsos');
    const fila=admin.locator('article').filter({hasText:entrada.codigo});
    await fila.getByRole('button',{name:'Aprobar',exact:true}).click();
    await fila.getByRole('button',{name:'Registrar pago en efectivo'}).click();
    await expect(fila).toContainText('Pagado en efectivo');
    expect((await db.entrada.findUniqueOrThrow({where:{id:entrada.id}})).estado).toBe('REEMBOLSADA');
    await cli.close();await admin.close();
  }finally{
    await db.evento.update({where:{id:evento()},data:{estado:'PUBLICADO'}});
    await db.reembolsoEntrada.deleteMany({where:{entradaId:entrada.id}});
    await db.entrada.update({where:{id:entrada.id},data:{compraId:null,estado:entrada.estado}});
    await db.compraEntrada.delete({where:{id:compra.id}});
  }
});
test('HU-018 supervisor consulta sus ingresos y salidas', async ({browser,request})=>{
  const {crearUsuario,asignarClave}=require('../integracion/helpers/escenario');
  const {DOMINIO}=require('../integracion/helpers/limpieza');
  const {sufijo,clave}=leerDatos();
  const supervisor=await crearUsuario(db,'acceso-qa',sufijo,['ENCARGADO_ACCESO']);
  await asignarClave(db,[supervisor],clave);
  await db.staffEvento.create({data:{eventoId:evento(),usuarioId:supervisor,role:'ENCARGADO_ACCESO'}});
  const entrada=await db.entrada.findFirstOrThrow({where:{eventoId:evento(),titularId:esc().usuarios.cliente}});
  const fecha=await db.fechaEvento.findFirstOrThrow({where:{eventoId:evento()}});
  await db.accesoEvento.createMany({data:['INGRESO','SALIDA'].map(tipo=>({eventoId:evento(),entradaId:entrada.id,fechaId:fecha.id,tipo:tipo as 'INGRESO'|'SALIDA',encargadoId:supervisor}))});
  const login=await request.post('http://127.0.0.1:3000/api/auth/login',{data:{email:'acceso-qa.'+sufijo+DOMINIO,password:clave}});
  expect(login.ok()).toBe(true);
  const data=await login.json();
  const page=await browser.newPage();
  await page.addInitScript(({accessToken,user})=>{localStorage.setItem('eventix_token',accessToken);localStorage.setItem('eventix_user',JSON.stringify(user));},data);
  await page.goto('/supervisor/historial-accesos');
  await page.getByLabel('Fecha').selectOption(fecha.id);
  await expect(page.getByRole('cell',{name:'INGRESO',exact:true})).toBeVisible();
  await expect(page.getByRole('cell',{name:'SALIDA',exact:true})).toBeVisible();
  await page.close();
});
test('HU-030 encargado adjunta foto después de devolver puntos', async ({browser})=>{
  const page=await browser.newPage({storageState:sesion('devoluciones')});
  await page.goto('/devoluciones');
  await page.getByRole('button',{name:/Escanear Manilla/}).click();
  await page.locator('#codigo-manual').fill(esc().codigos.manilla);
  await page.getByRole('button',{name:'Buscar'}).click();
  await expect(page.getByRole('heading',{name:'Últimos movimientos del evento'})).toBeVisible();
  await page.getByRole('checkbox',{name:/Comparé la foto/}).check();
  await page.getByRole('button',{name:'Devolver Saldo'}).click();
  await page.getByRole('button',{name:'Confirmar Devolución'}).click();
  await expect(page.getByText('Devolución Exitosa')).toBeVisible();
  const tx=await db.transaccionSaldo.findFirstOrThrow({where:{eventoId:evento(),tipo:'DEVOLUCION',saldoResultante:0},orderBy:{createdAt:'desc'}});
  try {
    await page.locator('input[name=foto]').setInputFiles({name:'comprobante-qa.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/yJ0AAAAASUVORK5CYII=','base64')});
    await page.getByRole('button',{name:'Guardar comprobante'}).click();
    await expect(page.getByRole('status').filter({hasText:'Comprobante guardado.'})).toBeVisible();
    expect((await db.transaccionSaldo.findUniqueOrThrow({where:{id:tx.id}})).evidenciaUrl).toBeTruthy();
  }finally{
    const {evidenciaUrl}=await db.transaccionSaldo.findUniqueOrThrow({where:{id:tx.id}});
    if (evidenciaUrl) {
      const {v2:cloud}=require('cloudinary');
      cloud.config({cloud_name:process.env.CLOUDINARY_CLOUD_NAME,api_key:process.env.CLOUDINARY_API_KEY,api_secret:process.env.CLOUDINARY_API_SECRET});
      const id=new URL(evidenciaUrl).pathname.replace(/^.*\/upload\/(?:v\d+\/)?/,'').replace(/\.\w+$/,'');
      await cloud.uploader.destroy(decodeURIComponent(id));
    }
    await page.close();
  }
});
test('HU-049 el encargado registra la entrega en efectivo al titular', async ({browser})=>{
  const negocio=esc().negocioId;
  const titular=await db.negocio.findUniqueOrThrow({where:{id:negocio}});
  const documento='QA'+String(Date.now());
  await db.usuario.update({where:{id:titular.duenoId},data:{documento}});
  const operador=await db.usuario.findUniqueOrThrow({where:{email:leerDatos().emails.devoluciones}});
  await db.staffEvento.create({data:{usuarioId:operador.id,eventoId:leerDatos().eventoFinalizado,role:'DEVOLUCIONES'}});
  const r=await db.retiroGanancias.create({data:{negocioId:negocio,monto:30,estado:'APROBADO'}});
  const page=await browser.newPage({storageState:sesion('devoluciones')});
  try {
    await page.goto('/devoluciones/retiros');
    await page.getByLabel('Código de retiro').fill(r.id);
    await page.getByRole('button',{name:'Consultar retiro'}).click();
    await page.getByLabel('Documento del titular presente').fill(documento);
    await page.locator('#evidencia-retiro').setInputFiles('../frontend/src/assets/EventixLogo.png');
    await page.getByRole('button',{name:'Marcar como pagado'}).click();
    await expect.poll(async ()=>(await db.retiroGanancias.findUniqueOrThrow({where:{id:r.id}})).estado,{timeout:20000}).toBe('PAGADO');
  }finally{
    const comprobante=await db.retiroGanancias.findUniqueOrThrow({where:{id:r.id}});
    if(comprobante.evidenciaUrl){
      const {v2:cloud}=require('cloudinary');
      cloud.config({cloud_name:process.env.CLOUDINARY_CLOUD_NAME,api_key:process.env.CLOUDINARY_API_KEY,api_secret:process.env.CLOUDINARY_API_SECRET});
      const id=new URL(comprobante.evidenciaUrl).pathname.replace(/^.*\/upload\/(?:v\d+\/)?/,'').replace(/\.\w+$/,'');
      await cloud.uploader.destroy(decodeURIComponent(id));
    }
    await page.close();
  }
});
test('HU-028 saldo de un evento vencido queda sin opción de devolución',async({browser})=>{
  const cliente=await db.usuario.findUniqueOrThrow({where:{id:esc().usuarios.cliente}});
  const operador=await db.usuario.findUniqueOrThrow({where:{email:leerDatos().emails.devoluciones}});
  const {crearEventoPasado}=require('../integracion/helpers/escenario');
  const vencido=await crearEventoPasado(db,esc(),'Feria vencida QA','FINALIZADO',31);
  await db.staffEvento.deleteMany({where:{usuarioId:operador.id,role:'DEVOLUCIONES'}});
  await db.staffEvento.create({data:{usuarioId:operador.id,eventoId:vencido,role:'DEVOLUCIONES'}});
  await db.saldoEvento.create({data:{usuarioId:cliente.id,eventoId:vencido,saldo:65}});
  const page=await browser.newPage({storageState:sesion('devoluciones')});
  await page.goto('/devoluciones');
  await expect(page.getByText(/plazo de devolución.*venció/)).toBeVisible();
  await expect(page.getByRole('button',{name:/Escanear Manilla/})).toHaveCount(0);
  await page.close();
});
test('HU-018 supervisor conserva el historial de un evento finalizado',async({browser,request})=>{
  const {crearUsuario,asignarClave}=require('../integracion/helpers/escenario');
  const {DOMINIO}=require('../integracion/helpers/limpieza');
  const {sufijo,clave,eventoFinalizado}=leerDatos();
  const supervisor=await crearUsuario(db,'acceso-finalizado-qa',sufijo,['ENCARGADO_ACCESO']);
  await asignarClave(db,[supervisor],clave);
  await db.staffEvento.create({data:{eventoId:eventoFinalizado,usuarioId:supervisor,role:'ENCARGADO_ACCESO'}});
  const login=await request.post('http://127.0.0.1:3000/api/auth/login',{data:{email:'acceso-finalizado-qa.'+sufijo+DOMINIO,password:clave}});
  expect(login.ok()).toBe(true);
  const data=await login.json();
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.addInitScript(({accessToken,user})=>{localStorage.setItem('eventix_token',accessToken);localStorage.setItem('eventix_user',JSON.stringify(user));},data);
  await page.goto('/supervisor');
  await page.getByRole('button',{name:'Menú',exact:true}).click();
  await page.getByRole('link',{name:'Mi historial de accesos'}).click();
  await expect(page.getByRole('option',{name:/Feria finalizada e2e/})).toBeAttached({timeout:8000});
  await page.close();
});
test('móvil: nuevas pantallas del Sprint 3 caben a 390 px',async({browser})=>{
  for(const [rol,rutas] of [
    ['admin',['/admin/reportes','/admin/eventos/'+evento()+'/reportes','/admin/reembolsos']],
    ['organizador',[reporte()]], ['cliente',['/mis-reembolsos','/mi-manilla/movimientos?evento='+evento()]], ['devoluciones',['/devoluciones/historial']]
  ] as const){
    const page=await browser.newPage({storageState:sesion(rol),viewport:{width:390,height:844}});
    for(const ruta of rutas){
      await page.goto(ruta);
      await expect(page.getByRole('heading',{level:1}).first()).toBeVisible();
      await page.waitForLoadState('networkidle');
      const desborde=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
      expect.soft(desborde,ruta).toBeLessThanOrEqual(2);
    }
    await page.close();
  }
});
test('HU-036 bloquea otro organizador y HU-039 exporta ambos tipos de venta con montos correctos',async({browser,request})=>{
  const {sufijo,clave}=leerDatos();
  const {DOMINIO}=require('../integracion/helpers/limpieza');
  const login=await request.post('http://127.0.0.1:3000/api/auth/login',{data:{email:'organizador2.'+sufijo+DOMINIO,password:clave}});
  expect(login.ok()).toBe(true);
  const ajeno=await browser.newPage();
  await ajeno.addInitScript(({accessToken,user})=>{localStorage.setItem('eventix_token',accessToken);localStorage.setItem('eventix_user',JSON.stringify(user));},await login.json());
  await ajeno.goto(reporte());
  await expect(ajeno.getByRole('alert')).toContainText('Evento no encontrado');
  await expect(ajeno.getByRole('button',{name:'Descargar CSV'})).toHaveCount(0);
  await ajeno.close();
  const e=esc();
  const compra=await db.compraEntrada.create({data:{usuarioId:e.usuarios.cliente,eventoId:evento(),estado:'APROBADA',montoTotal:12.3}});
  const venta=await db.venta.create({data:{eventoId:evento(),negocioId:e.negocioId,ayudanteId:e.usuarios.ayudante,total:4.5}});
  const page=await browser.newPage({storageState:sesion('organizador')});
  try{
    await page.goto(reporte());
    const read=async(button:string)=>{
      const [d]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:button}).click()]);
      return require('fs').promises.readFile(await d.path());
    };
    const csv=(await read('Descargar CSV')).toString('utf8');
    expect(csv.split(/\r?\n/).filter((l:string)=>l.includes(compra.id))[0]).toMatch(/;12\.30$/);
    expect(csv.split(/\r?\n/).filter((l:string)=>l.includes(venta.id))[0]).toMatch(/;4\.50$/);
    const {Workbook}=require('exceljs');
    const libro=new Workbook();await libro.xlsx.load(await read('Descargar Excel'));
    const valores=libro.getWorksheet('Ventas').getSheetValues();
    expect(valores.some((v:unknown[])=>v?.[2]===compra.id && v[5]===12.3)).toBe(true);
    expect(valores.some((v:unknown[])=>v?.[2]===venta.id && v[5]===4.5)).toBe(true);
  }finally{
    await db.compraEntrada.delete({where:{id:compra.id}});
    await db.venta.delete({where:{id:venta.id}});
    await page.close();
  }
});
