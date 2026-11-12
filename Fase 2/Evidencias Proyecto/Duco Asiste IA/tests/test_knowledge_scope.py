import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("duco_admin", Path(__file__).parents[1] / "admin-app" / "app.py")
app = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app)


class Cursor:
    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def execute(self, query, *args, **kwargs):
        if "FROM PREGUNTAS_FRECUENTES f" in query:
            self.rows = [
                (1, "resalta algo", "Entendido. Resaltando 'Carreras Técnicas y Profesionales' para que lo veas.", "General"),
                (2, "¿Cuándo es la matrícula?", "La matrícula se realiza en enero.", "Admisión"),
            ]
        elif "FROM PROPUESTAS_CONOCIMIENTO" in query:
            self.rows = [("me lo resaltas devuelta?", "Listo, repito el resaltado.")]
        else:
            self.rows = []

    def __iter__(self):
        return iter(self.rows)


class Connection:
    def cursor(self):
        return Cursor()


class KnowledgeScopeTests(unittest.TestCase):
    def test_visual_feedback_is_contextual(self):
        cases = [
            ("resalta algo", "Entendido. Resaltando 'Carreras Técnicas y Profesionales'."),
            ("me lo resaltas devuelta?", "Listo, repito el resaltado."),
            ("puedes resaltarme algo en el sitio?", "¿Qué quieres que resalte?"),
            ("lo que tu quieras", "Carreras Técnicas y Profesionales"),
        ]
        for question, answer in cases:
            with self.subTest(question=question):
                self.assertTrue(app.is_contextual_exchange(question, answer))
        self.assertTrue(app.is_contextual_exchange("otra consulta", "respuesta", "navigation"))

    def test_facts_remain_reusable(self):
        self.assertFalse(app.is_contextual_exchange("¿Cuándo es la matrícula?", "La matrícula se realiza en enero."))
        self.assertFalse(app.is_contextual_exchange("¿Cómo funciona el resaltado?", "El asistente destaca el texto solicitado."))

    def test_legacy_visual_knowledge_is_excluded(self):
        self.assertEqual(app.Handler.search_knowledge(Connection(), "resalta algo"), [])
        items = app.Handler.search_knowledge(Connection(), "matrícula")
        self.assertEqual(len(items), 1)
        self.assertIn("enero", items[0]["answer"])


if __name__ == "__main__":
    unittest.main()
