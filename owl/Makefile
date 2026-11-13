# OWL — perintah yang dipakai sehari-hari.
#
#   make setup     pasang dependensi backend dan frontend
#   make backend   jalankan OWL Core di :8000
#   make frontend  jalankan dashboard di :5173
#   make demo      seed dua perangkat lalu jalankan gerbang, tanpa browser
#   make test      jalankan uji backend
#   make snapshot  rekam ulang hasil penilaian untuk mode luring dashboard
#   make up        seluruh stack lewat Docker Compose

PY := services/backend/.venv/bin/python
PIP := services/backend/.venv/bin/pip
API ?= http://localhost:8000

.PHONY: setup backend frontend demo test snapshot up down clean agent

setup:
	python3 -m venv services/backend/.venv
	$(PIP) install -q -r services/backend/requirements.txt pytest
	cd frontend && npm install
	@echo "siap. jalankan: make backend (terminal 1), make frontend (terminal 2)"

backend:
	cd services/backend && .venv/bin/python -m uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

test:
	$(PY) -m pytest tests -q

demo:
	@echo "== memuat dua perangkat contoh =="
	@curl -s -X POST $(API)/api/demo/seed | $(PY) -m json.tool
	@echo "\n== gerbang: sistem terklasifikasi =="
	@curl -s -X POST "$(API)/api/gate/TACTICAL-07?resource=classified" | $(PY) -m json.tool
	@curl -s -X POST "$(API)/api/gate/KOMANDO-02?resource=classified" | $(PY) -m json.tool
	@echo "\n== baris CEF yang dikirim ke SIEM =="
	@curl -s "$(API)/api/devices/KOMANDO-02/cef" | $(PY) -c "import json,sys; print(json.load(sys.stdin)['cef'])"

snapshot:
	$(PY) -I services/backend/tools/snapshot.py
	@echo "rekaman dipakai dashboard saat OWL Core tidak terjangkau"

agent:
	cd agent/android && ./gradlew assembleDebug \
	  -PowlBase=http://10.0.2.2:8000 -PowlToken=owl-demo-token

up:
	docker compose up --build

down:
	docker compose down -v

clean:
	rm -f services/backend/owl.db
	rm -rf frontend/dist
