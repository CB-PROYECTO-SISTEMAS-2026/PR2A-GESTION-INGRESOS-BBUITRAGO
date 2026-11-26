import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Skeleton } from '../../components/ui/Skeleton'

/** La compra ocurre en modal desde el detalle del evento. */
export default function CompraEntradasPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  useEffect(() => {
    if (id) navigate(`/eventos/${id}`, { replace: true, state: { openCompra: true } })
  }, [id, navigate])

  return (
    <div className="mx-auto max-w-6xl space-y-3 px-4 py-12" aria-busy="true">
      <span className="sr-only">Redirigiendo al evento…</span>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
      <p className="text-sm text-muted">
        Si no redirige,{' '}
        <Link to={`/eventos/${id}`} className="font-semibold text-primary">
          vuelve al evento
        </Link>
        .
      </p>
    </div>
  )
}
