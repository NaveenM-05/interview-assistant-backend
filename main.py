# main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import time
import json
from llm_parser import extract_dsa_schema

app = FastAPI(title="Interview Assistant API")

@app.websocket("/ws/interview/{session_id}")
async def interview_websocket(websocket: WebSocket, session_id: str):
    await websocket.accept()
    print(f"Session {session_id} connected.")
    
    try:
        while True:
            # 1. Ingest Text Payload from Edge
            text_payload = await websocket.receive_text()
            start_time = time.perf_counter() 
            print(f"Received from Edge: {text_payload}")
            
            # 2. Schema-Constrained LLM Extraction
            t_llm_start = time.perf_counter()
            extracted_json = extract_dsa_schema(text_payload)
            t_llm_end = time.perf_counter()
            
            print(f"Extracted JSON: {extracted_json}")
            
            # 3. Latency Calculations
            t_llm_latency_ms = round((t_llm_end - t_llm_start) * 1000, 2)
            total_latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            
            # 4. Package Response Payload
            response = {
                "barge_in_prompt": f"Extracted complexity: {extracted_json.get('time_complexity')}",
                "metrics": {
                    "T_LLM_ms": t_llm_latency_ms,
                    "Total_Cloud_Latency_ms": total_latency_ms
                },
                "raw_extraction": extracted_json
            }
            
            # 5. Dispatch back to Client
            await websocket.send_text(json.dumps(response))
            
    except WebSocketDisconnect:
        print(f"Session {session_id} disconnected.")