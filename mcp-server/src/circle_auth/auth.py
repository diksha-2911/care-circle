import os
import jwt
import requests

from fastmcp.server.auth import AccessToken, TokenVerifier


class SupabaseTokenVerifier(TokenVerifier):

    async def verify_token(self, token: str) -> AccessToken | None:
        try:
            supabase_url = os.environ["SUPABASE_URL"]

            jwks_url = (
                f"{supabase_url}/auth/v1/.well-known/jwks.json"
            )

            jwks = requests.get(jwks_url, timeout=5).json()

            signing_key = None

            unverified_header = jwt.get_unverified_header(token)

            for key in jwks["keys"]:
                if key["kid"] == unverified_header["kid"]:
                    signing_key = jwt.algorithms.ECAlgorithm.from_jwk(key)
                    break

            if signing_key is None:
                print(
                    f"No matching signing key found for kid "
                    f"{unverified_header.get('kid')}"
                )
                return None

            payload = jwt.decode(
                token,
                signing_key,
                algorithms=["ES256"],
                audience="authenticated",
            )

            user_id = payload.get("sub")

            if not user_id:
                print("Token has no user ID")
                return None

            print(f"Token verified for user: {user_id}")

            return AccessToken(
                token=token,
                client_id=user_id,
                scopes=[],
                expires_at=payload.get("exp"),
                subject=user_id,
                claims=payload,
            )

        except Exception as error:
            print(f"Token verification failed: {error}")
            return None