# IBVAP / BorderGuard AI — Continuation & Hardening Brief

You are a staff-level full-stack architect, computer-vision engineer, NVIDIA GPU performance engineer, and UI/UX designer. Continue the existing **BorderGuard AI / IBVAP** prototype in this repository. Treat its current code, UI direction, data, and APIs as the starting point—not as a blank project.

## Mission

Turn the existing college/hackathon prototype into a reliable, demonstrable, privacy-aware intelligent video-analytics platform. Ordinary authorized ONVIF/RTSP CCTV feeds must become software-defined sensors: detect, track, apply virtual-perimeter rules, record evidence, and alert human operators. The system must never take physical action or make final security decisions.

## Non-negotiable guardrails

- AI only detects, classifies, tracks, and creates reviewable alerts. A human makes every final decision.
- Never label people as dangerous, hostile, or enemies.
- Process only authorized feeds. Keep PII exposure minimal; no face identification. Optional face detection may report a region only. ANPR is demonstration/authorized-use only and always marked for human verification.
- Never log, return, or expose RTSP passwords. Redact stream URLs in models, APIs, errors, audit logs, and UI.
- Preserve role boundaries: `ADMIN`, `OPERATOR`, and `VIEWER`. Every mutating action must be authorized and audited.

## Existing implementation: preserve these choices unless a migration is explicitly approved

- Frontend: React 18, Vite, JavaScript/JSX, Tailwind CSS, Axios, React Router, Recharts.
- Backend: Flask, Flask-SQLAlchemy/SQLAlchemy, PostgreSQL by default with a documented local SQLite fallback.
- Real-time delivery: MJPEG for current browser video and SSE for operational events.
- Pipeline: a per-camera worker currently combines OpenCV frames, YOLO (when available) or simulation fallback, centroid tracking, zones/rules, still-image evidence, alerts, and annotated frames.
- Existing pages: login, dashboard, cameras/detail, events, alerts, analytics, zones, and settings. Retain the dark command-center visual language and the explicit “human verification” messaging.

Do **not** replace Flask with FastAPI, convert the frontend to TypeScript, introduce Zustand, Redis, Docker, MediaMTX, WebRTC, HLS, TensorRT, or a microservice split merely to match an aspirational stack. Propose any such migration separately with measurable benefits, compatibility impact, and approval required. WebRTC/HLS can be a later optional deployment adapter; MJPEG+SSE remains the demo baseline.

## Work sequence (required)

1. Audit before editing. Inspect the repository, dependencies, startup path, current data model, routes, UI, and demo assets. Report the concrete “implemented / partial / missing / broken” matrix. Do not assume a feature works because source files exist.
2. Establish a runnable baseline. Supply a minimal `.env.example`, installation/start instructions, and a smoke test for backend health, authentication, and frontend build. Resolve incompatible data-layer initialization or import usage before adding capabilities. Do not embed development secrets in committed code.
3. Make one vertical slice fully dependable at a time. For each change: preserve existing APIs where practical, add migrations or safe schema evolution, handle failures, and verify it with tests or a reproducible manual check.
4. Keep documentation current: architecture, API/event contracts, configuration, demo procedure, limitations, and accepted risk.

## Required implementation roadmap

### P0 — prototype reliability and demo

- Ensure frontend build and backend startup operate from documented commands.
- Make `START DEMO` deterministic using loopable local, authorized demo videos. If no video files are supplied, use clearly labeled synthetic frames/detections without claiming live AI inference.
- Keep camera failures isolated. A failed RTSP/decode/inference worker must neither stop the API nor affect other cameras.
- Define and consistently expose `CONNECTING`, `CONNECTED`, `RECONNECTING`, `DISCONNECTED`, and `ERROR`. Maintain a UI-compatible mapping only if legacy `ONLINE`/`OFFLINE` values cannot be migrated safely.
- Implement bounded exponential reconnect backoff, cancellation on disable/stop, and visible last-error/last-active diagnostics (with secrets redacted).
- Emit typed SSE events for camera-state changes, detections, alerts, and demo lifecycle. Clients must tolerate reconnects and duplicate events.
- Ensure every alert and event visibly states that operator verification is required.

### P1 — analytics correctness

- Formalize `DetectorInterface` and `TrackerInterface`; keep the current YOLO/OpenCV/simulation adapters behind those interfaces. Detector output must have label, confidence, bounding box, timestamp, and source. Tracker output must supply a stable local track ID, history, and lifecycle state.
- Improve the current centroid tracker only behind `TrackerInterface`; make ByteTrack/DeepSORT optional adapters, not new hard dependencies.
- Implement normalized polygon zones and directed virtual lines with validation. Support: restricted-zone entry, zone exit, directional line crossing, and loitering/dwell time.
- Correlate detections into events. For an intrusion default: confidence at least 0.80, restricted-zone entry, and persistence for 3 seconds. Make thresholds configurable per rule and add cooldown/deduplication so individual boxes do not become alert storms.
- Record event metadata including camera, rule/zone, object class, track ID, confidence, detection source, timestamps, and a human-review flag.
- Preserve evidence stills. Add event clips only when a bounded ring buffer and disk quota can be implemented safely; target 10 seconds pre-event and 20 seconds post-event. Clearly report when clip capture is unavailable.

### P2 — performance and operational visibility

- Add per-camera processing FPS, decode FPS, inference latency, frame-drop count, worker state, and current detector source; display them in analytics and camera detail views.
- Add a conservative adaptive-quality controller: reduce sampled inference FPS first, then input resolution, then optional batch size when latency or GPU-memory thresholds are exceeded. Never stop browser video merely because inference is degraded.
- Use bounded queues/ring buffers and release OpenCV/CUDA resources on worker shutdown. Do not claim GPU metrics/control without the required runtime being present.
- Add retention and disk-quota policies for evidence, events, and clips. Purges must be auditable and safe.

### P3 — camera onboarding and deployment readiness

- Keep manual RTSP configuration. Add ONVIF discovery only as an optional capability with timeouts, explicit operator selection, and no credential logging.
- Add a deployment document and optional Compose files only after the single-process demo is stable. PostgreSQL is the supported primary database; SQLite must be explicitly marked demo-only if used.
- If a future low-latency deployment requires MediaMTX/WebRTC/HLS, implement it as an adapter with a feature flag and retain the MJPEG fallback.

## UI requirements

- Retain the dark operations/command-center look; avoid generic CRUD layouts.
- Dashboard: health summary, live/demo grid, current alerts, site/zone context, and clearly labeled detection source.
- Camera detail: annotated feed, zones/lines, camera state, diagnostics, controls permitted by role, and recent events.
- Events: filter by time, camera, object class, rule/zone, severity, and status; show evidence and audit-relevant details.
- Alerts: severity `INFO`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`; lifecycle `NEW`, `ACKNOWLEDGED`, `RESOLVED`; no automatic resolution.
- Accessibility: keyboard-operable controls, visible focus, meaningful empty/error states, and sufficient contrast.

## Security and API expectations

- Keep JWT authentication, but do not expose long-lived JWTs in MJPEG/SSE query parameters. Use secure, short-lived, scoped stream authorization or an equivalent browser-compatible mechanism; redact tokens from logs.
- Validate all request payloads, zone geometries, pagination/filter values, and uploaded/local-path references. Use allowlisted demo media paths.
- Document REST and SSE contracts, including payload versions and error behavior. Prefer backward-compatible additions.

## Definition of done for each delivered increment

- The app starts from a clean documented setup.
- Frontend production build succeeds.
- Backend import/startup and health endpoint succeed with the documented database configuration.
- Role authorization is tested for relevant endpoints.
- At least one demo camera can start, emit annotated frames, create a deduplicated event from a rule, publish an SSE update, and expose redacted evidence metadata.
- Failure of one invalid/offline camera is visible and self-healing without stopping another demo camera or the API.
- No credentials, long-lived tokens, or unredacted RTSP URLs appear in output, logs, API responses, screenshots, or evidence metadata.

## Delivery format

Before edits, provide the audit matrix and a small implementation plan for the chosen increment. Then deliver complete runnable files (not isolated snippets), a concise change log, exact verification commands/results, and any known limitations. Do not block on a new greenfield system-design document: update the design documentation incrementally after the repository audit.
