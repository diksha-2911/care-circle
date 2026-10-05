import asyncio
import base64
import json
import os

from dotenv import load_dotenv
from fastmcp import Client
from openai import OpenAI
from supabase import create_client, Client as SupabaseClient

load_dotenv()

mcp_server_url = os.environ["MCP_SERVER_URL"]
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_ANON_KEY = os.environ["SUPABASE_ANON_KEY"]
email = os.environ["ALEXA_EMAIL"]
password = os.environ["ALEXA_PASSWORD"]

groq = OpenAI(
    api_key=os.environ["GROQ_API_KEY"],
    base_url="https://api.groq.com/openai/v1",
)

supabase: SupabaseClient = create_client(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
)

auth_response = supabase.auth.sign_in_with_password({
    "email": email,
    "password": password,
})

if not auth_response.user or not auth_response.session:
    raise Exception("Supabase login failed")

user_id = auth_response.user.id
access_token = auth_response.session.access_token

print(f"✓ Authenticated as: {email}")
print(f"✓ User ID: {user_id}")

def build_tool_definitions(tools):
    definitions = []

    for tool in tools:
        definitions.append(
            {
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description or "",
                    "parameters": tool.inputSchema,
                },
            }
        )

    return definitions


async def main():

    async with Client(mcp_server_url, auth=access_token,) as mcp:

        # Discover tools from the MCP server
        tools = await mcp.list_tools()

        tool_definitions = build_tool_definitions(tools)

        print("=================================")
        print("   Care Circle MCP Assistant")
        print("=================================")
        print(f"Connected to MCP server")
        print(f"Discovered {len(tools)} tools:")
        
        for tool in tools:
            print(f"  - {tool.name}")

        print()
        print("Type 'quit' to exit.")
        print()

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a helpful healthcare assistant for the Care Circle app. "
                    "You can use the available MCP tools to access and update care-circle "
                    "information. Always use the appropriate tool when real data is needed. "
                    "Never invent medication, appointment, refill, or care-circle data. "
                    "Keep responses concise and easy to understand."
                ),
            }
        ]

        while True:

            user_input = input("You: ").strip()

            if user_input.lower() in {"quit", "exit"}:
                print("Goodbye!")
                break

            if not user_input:
                continue

            messages.append(
                {
                    "role": "user",
                    "content": user_input,
                }
            )

            response = groq.chat.completions.create(
                model="openai/gpt-oss-20b",
                messages=messages,
                tools=tool_definitions,
                tool_choice="auto",
            )

            assistant_message = response.choices[0].message

            # Save the assistant's decision
            messages.append(assistant_message)

            if assistant_message.tool_calls:

                for tool_call in assistant_message.tool_calls:

                    tool_name = tool_call.function.name
                    arguments = json.loads(tool_call.function.arguments)

                    print(f"\n🔧 Calling MCP tool: {tool_name}")
                    print(f"📦 Arguments: {arguments}")

                    try:
                        result = await mcp.call_tool(
                            tool_name,
                            arguments,
                        )

                        tool_result = result.data

                        print(f"📡 MCP result: {tool_result}")

                    except Exception as error:
                        tool_result = {
                            "status": "error",
                            "message": str(error),
                        }

                        print(f" MCP error: {error}")

                    # Give the MCP result back to Groq
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "content": json.dumps(tool_result),
                        }
                    )

                # Ask Groq to turn the tool result into a human response
                final_response = groq.chat.completions.create(
                    model="openai/gpt-oss-20b",
                    messages=messages,
                )

                answer = final_response.choices[0].message.content

                messages.append(
                    {
                        "role": "assistant",
                        "content": answer,
                    }
                )

                print(f"\nAssistant: {answer}\n")

            else:
                # The model answered without needing an MCP tool
                answer = assistant_message.content

                print(f"\nAssistant: {answer}\n")


if __name__ == "__main__":
    asyncio.run(main())