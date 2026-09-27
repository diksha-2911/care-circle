"""MCP Apps: inline visual for "show me today's medication schedule".

Returns an HTML payload that Alexa+ renders natively inside the
conversation view (via the MCP Apps webview), scaled to whatever device
the customer is on. See docs/architecture.md for how this differs from
the standalone React Native app.
"""


def render_schedule_widget(prescriptions: list[dict]) -> str:
    rows = "".join(
        f"<tr><td>{p['drug_name']}</td><td>{p['dosage']}</td>"
        f"<td>{', '.join(p['alarm_times'])}</td></tr>"
        for p in prescriptions
    )

    return f"""
    <div style="font-family: sans-serif; padding: 16px;">
      <h2>Today's Medications</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><th>Medication</th><th>Dosage</th><th>Time</th></tr>
        {rows}
      </table>
    </div>
    """
