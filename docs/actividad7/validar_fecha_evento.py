"""Validación del rango de fechas de un evento (EvenTix).

Generado con asistencia de Cursor a partir del prompt documentado en README.md
y revisado manualmente para mensajes en español y casos límite.
"""

from __future__ import annotations

from datetime import date
from typing import Tuple


def validar_rango_fechas_evento(
    fecha_inicio: date,
    fecha_fin: date,
    fecha_referencia: date,
) -> Tuple[bool, str]:
    """Valida el rango de fechas al crear o reprogramar un evento.

    Reglas:
    - La fecha de inicio no puede ser posterior a la de fin.
    - La fecha de inicio no puede ser anterior a la fecha de referencia (p. ej. hoy).
    """
    if not isinstance(fecha_inicio, date) or not isinstance(fecha_fin, date):
        return False, "Las fechas de inicio y fin deben ser objetos date."
    if not isinstance(fecha_referencia, date):
        return False, "La fecha de referencia debe ser un objeto date."

    if fecha_inicio > fecha_fin:
        return False, "La fecha de inicio no puede ser posterior a la fecha de fin."

    if fecha_inicio < fecha_referencia:
        return False, "La fecha de inicio no puede ser anterior a hoy."

    if fecha_inicio == fecha_fin:
        return True, "Evento de un solo día válido."

    return True, "Rango de fechas válido."
