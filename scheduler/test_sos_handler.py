"""Initial lightweight unit tests; run after installing scheduler dependencies."""
import json
import os
import sys
import unittest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))
import sos_handler


class SosHandlerResponseTests(unittest.TestCase):
    def test_options_returns_cors_response_without_database(self):
        response = sos_handler.lambda_handler({'httpMethod': 'OPTIONS'}, None)
        self.assertEqual(response['statusCode'], 204)

    @patch.object(sos_handler, '_db')
    def test_missing_bearer_token_returns_401(self, mock_db):
        mock_db.return_value = MagicMock()
        response = sos_handler.lambda_handler({'httpMethod': 'POST', 'path': '/sos', 'headers': {}, 'body': '{}'}, None)
        self.assertEqual(response['statusCode'], 401)
        self.assertIn('bearer token', json.loads(response['body'])['error'].lower())


if __name__ == '__main__':
    unittest.main()
