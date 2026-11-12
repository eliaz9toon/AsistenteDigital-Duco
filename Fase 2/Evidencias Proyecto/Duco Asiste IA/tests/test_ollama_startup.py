import importlib.util
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import threading
import unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen


spec = importlib.util.spec_from_file_location("duco_admin", Path(__file__).parents[1] / "admin-app" / "app.py")
app = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app)


class OllamaStartupTests(unittest.TestCase):
    def test_existing_server_is_reused_and_never_stopped(self):
        service = app.OllamaService()
        with patch.object(service, "is_online", return_value=True), patch.object(app.subprocess, "Popen") as spawn:
            self.assertEqual(service.ensure_running(), {"online": True, "started": False})
            service.close()
            spawn.assert_not_called()

    def test_concurrent_requests_start_one_process_and_close_it(self):
        service = app.OllamaService()
        process = Mock()
        process.poll.return_value = None
        with patch.object(service, "is_online", side_effect=lambda: service.process is not None), \
                patch.object(service, "executable", return_value="ollama.exe"), \
                patch.object(Path, "open", unittest.mock.mock_open()), \
                patch.object(app.subprocess, "Popen", return_value=process) as spawn:
            with ThreadPoolExecutor(max_workers=4) as pool:
                results = list(pool.map(lambda _: service.ensure_running(), range(4)))
            self.assertTrue(all(result["online"] for result in results))
            spawn.assert_called_once()
            self.assertEqual(spawn.call_args.args[0], ["ollama.exe", "serve"])
            self.assertEqual(spawn.call_args.kwargs["env"]["OLLAMA_HOST"], "127.0.0.1:11434")
            service.close()
            process.terminate.assert_called_once()
            process.wait.assert_called_once_with(timeout=5)

    def test_missing_installation_returns_an_actionable_error(self):
        service = app.OllamaService()
        with patch.object(service, "is_online", return_value=False), \
                patch.object(service, "executable", return_value=None):
            result = service.ensure_running()
            self.assertFalse(result["online"])
            self.assertIn("instalado", result["error"])

    def test_failed_process_can_be_started_again(self):
        service = app.OllamaService()
        failed = Mock()
        failed.poll.return_value = 1
        replacement = Mock()
        replacement.poll.return_value = None
        with patch.object(service, "is_online", side_effect=lambda: service.process is replacement), \
                patch.object(service, "executable", return_value="ollama.exe"), \
                patch.object(Path, "open", unittest.mock.mock_open()), \
                patch.object(app.subprocess, "Popen", side_effect=[failed, replacement]) as spawn:
            self.assertFalse(service.ensure_running()["online"])
            self.assertTrue(service.ensure_running()["online"])
            self.assertEqual(spawn.call_count, 2)
            service.close()

    def test_health_and_startup_routes_do_not_need_oracle(self):
        with patch.object(app, "db_session", side_effect=AssertionError("No Oracle needed")), \
                patch.object(app.ollama_service, "ensure_running", return_value={"online": True, "started": False}) as ensure:
            server = app.ThreadingHTTPServer(("127.0.0.1", 0), app.Handler)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base_url = f"http://127.0.0.1:{server.server_port}"
            try:
                with urlopen(base_url + "/api/duco/health") as response:
                    self.assertEqual(json.load(response)["service"], "duco-admin")
                request = Request(base_url + "/api/duco/ollama/ensure", data=b"{}", headers={
                    "Content-Type": "application/json", "Origin": "http://127.0.0.1:5500"})
                with urlopen(request) as response:
                    self.assertTrue(json.load(response)["online"])
                    self.assertEqual(response.headers["Access-Control-Allow-Origin"], "http://127.0.0.1:5500")
                request.add_header("Origin", "https://example.com")
                with self.assertRaises(HTTPError) as caught:
                    urlopen(request)
                self.assertEqual(caught.exception.code, 403)
                ensure.assert_called_once()
            finally:
                server.shutdown()
                server.server_close()
                thread.join()


if __name__ == "__main__":
    unittest.main()
