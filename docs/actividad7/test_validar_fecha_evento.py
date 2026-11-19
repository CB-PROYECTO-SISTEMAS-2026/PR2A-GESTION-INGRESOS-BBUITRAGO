"""Pruebas unitarias de validar_rango_fechas_evento."""

from __future__ import annotations

import unittest
from datetime import date, timedelta

from validar_fecha_evento import validar_rango_fechas_evento


class TestValidarRangoFechasEvento(unittest.TestCase):
    def setUp(self) -> None:
        self.hoy = date(2026, 11, 19)

    def test_rango_varios_dias_valido(self) -> None:
        ok, msg = validar_rango_fechas_evento(
            date(2026, 11, 20), date(2026, 11, 22), self.hoy
        )
        self.assertTrue(ok)
        self.assertIn("válido", msg.lower())

    def test_evento_un_solo_dia_es_valido(self) -> None:
        """Caso límite: inicio == fin."""
        dia = date(2026, 11, 19)
        ok, msg = validar_rango_fechas_evento(dia, dia, self.hoy)
        self.assertTrue(ok)
        self.assertIn("un solo día", msg.lower())

    def test_inicio_posterior_a_fin(self) -> None:
        ok, msg = validar_rango_fechas_evento(
            date(2026, 11, 25), date(2026, 11, 20), self.hoy
        )
        self.assertFalse(ok)
        self.assertIn("posterior", msg.lower())

    def test_inicio_en_el_pasado(self) -> None:
        """Caso límite: inicio = hoy - 1 día."""
        ayer = self.hoy - timedelta(days=1)
        ok, msg = validar_rango_fechas_evento(ayer, self.hoy, self.hoy)
        self.assertFalse(ok)
        self.assertIn("anterior a hoy", msg.lower())

    def test_inicio_igual_a_hoy_valido(self) -> None:
        ok, _ = validar_rango_fechas_evento(self.hoy, self.hoy + timedelta(days=2), self.hoy)
        self.assertTrue(ok)


if __name__ == "__main__":
    unittest.main()
