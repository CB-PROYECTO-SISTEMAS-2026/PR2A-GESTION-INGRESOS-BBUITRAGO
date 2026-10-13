/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *  PRUEBA UNITARIA (FRONTEND) · Gráfico y filtros del panel de ventas del dueño (HU-025)
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *  QUÉ VERIFICA
 *    Componentes de frontend/src/modules/business/components/VentasUI.jsx:
 *      1. VentasPorDiaChart: barras proporcionales al monto, el monto visible sobre cada barra,
 *         una descripción accesible por barra, la tabla con los mismos datos y el mensaje
 *         cuando no hay ventas.
 *      2. FiltrosVentas: los botones "Hoy / 7 días / 30 días" ponen el rango correcto y marcan
 *         cuál está activo; el selector de negocio solo aparece si hay más de uno.
 *
 *  POR QUÉ IMPORTA
 *    El dueño decide con estos números. Una barra mal escalada o un rango de fechas corrido
 *    muestran una caja que no cuadra.
 *
 *  CÓDIGO PROBADO
 *    frontend/src/modules/business/components/VentasUI.jsx y ventasFiltros.js
 *
 *  CÓMO EJECUTARLA
 *    cd tests
 *    npm run test:frontend                                      (todas las del frontend)
 *    npx vitest run frontend-unit/business/VentasUI.test.jsx    (solo este archivo)
 *
 *  REQUISITOS
 *    Ninguno: no usa base de datos, backend ni navegador real. La fecha de "hoy" se fija en
 *    cada prueba (10 de octubre de 2026, hora de La Paz).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FiltrosVentas, VentasPorDiaChart } from '../../../frontend/src/modules/business/components/VentasUI';

describe('VentasPorDiaChart', () => {
  const datos = [
    { dia: '2026-10-08', total: '0.00' },
    { dia: '2026-10-09', total: '50.00' },
    { dia: '2026-10-10', total: '25.00' },
  ];

  it('dibuja barras proporcionales al monto (la mayor ocupa el 100%)', () => {
    render(<VentasPorDiaChart datos={datos} />);
    const alto = (etiqueta) =>
      screen.getByLabelText(etiqueta).querySelector('div[style]').style.height;
    expect(alto('9 oct: Bs 50')).toBe('100%');
    expect(alto('10 oct: Bs 25')).toBe('50%');
    expect(alto('8 oct: Bs 0')).toBe('0%');
  });

  it('muestra el monto sobre cada barra con ventas y una tabla con los mismos datos', () => {
    render(<VentasPorDiaChart datos={datos} />);
    expect(screen.getAllByText('Bs 50').length).toBeGreaterThanOrEqual(2); // barra + tabla
    expect(screen.getByText('Ver como tabla')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });

  it('sin ventas muestra un mensaje en lugar del gráfico', () => {
    render(<VentasPorDiaChart datos={[{ dia: '2026-10-10', total: '0.00' }]} />);
    expect(screen.getByText('Sin ventas en este periodo.')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Ventas por día' })).not.toBeInTheDocument();
  });
});

describe('FiltrosVentas', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-10-10T16:00:00.000Z'), toFake: ['Date'] });
  });
  afterEach(() => vi.useRealTimers());

  const filtrosBase = { desde: '2026-10-04', hasta: '2026-10-10', negocioId: '', eventoId: '' };

  it.each([
    ['Hoy', '2026-10-10', '2026-10-10'],
    ['7 días', '2026-10-04', '2026-10-10'],
    ['30 días', '2026-09-11', '2026-10-10'],
  ])('el botón "%s" pone el rango %s – %s', (boton, desde, hasta) => {
    const onChange = vi.fn();
    render(<FiltrosVentas filtros={filtrosBase} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: boton }));
    expect(onChange).toHaveBeenCalledWith({ ...filtrosBase, desde, hasta });
  });

  it('marca como activo el rango que coincide con las fechas elegidas', () => {
    render(<FiltrosVentas filtros={filtrosBase} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: '7 días' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Hoy' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('el selector de negocio solo aparece si el dueño tiene más de un negocio', () => {
    const { rerender } = render(
      <FiltrosVentas filtros={filtrosBase} onChange={() => {}} negocios={[{ id: 'n1', nombre: 'Uno' }]} />,
    );
    expect(screen.queryByLabelText('Negocio')).not.toBeInTheDocument();

    rerender(
      <FiltrosVentas
        filtros={filtrosBase}
        onChange={() => {}}
        negocios={[
          { id: 'n1', nombre: 'Uno' },
          { id: 'n2', nombre: 'Dos' },
        ]}
      />,
    );
    expect(screen.getByLabelText('Negocio')).toBeInTheDocument();
  });
});
