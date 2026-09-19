(function (root) {
	'use strict';
	const VERSION = '20260919-live2';
	const CHANNEL = 'jumper-mobile-video-v2';
	const CHUNK = 12000, MAX_FRAME = 700000, MAX_PARTS = 60;
	class FrameReceiver {
		constructor(onFrame, getState, onDrop = () => {}) { this.onFrame = onFrame; this.getState = getState; this.onDrop = onDrop; this.clear(); }
		clear() { this.frame = null; this.sequence = -1; this.sessionId = null; clearTimeout(this.timer); }
		accept(raw) {
			if (typeof raw !== 'string' || raw.length > CHUNK + 1024) return this.onDrop('packet_size');
			let part; try { part = JSON.parse(raw); } catch { return this.onDrop('invalid_json'); }
			const state = this.getState(), now = Date.now();
			if (!state.ready || state.printerObservation || !state.sessionId || part.sessionId !== state.sessionId) return this.onDrop('not_ready');
			if (this.sessionId !== state.sessionId) { this.clear(); this.sessionId = state.sessionId; }
			if (part.source !== 'phone' || part.mimeType !== 'image/jpeg' || !Number.isSafeInteger(part.sequence)
				|| part.sequence <= this.sequence || !Number.isInteger(part.index) || !Number.isInteger(part.count)
				|| part.count < 1 || part.count > MAX_PARTS || part.index < 0 || part.index >= part.count
				|| typeof part.data !== 'string' || part.data.length > CHUNK
				|| !Number.isFinite(Date.parse(part.capturedAt)) || Math.abs(now - Date.parse(part.capturedAt)) > 3000) return this.onDrop('invalid_or_old');
			if (this.frame && part.sequence < this.frame.sequence) return this.onDrop('superseded');
			if (!this.frame || this.frame.sequence !== part.sequence) {
				if (this.frame) this.onDrop('incomplete');
				clearTimeout(this.timer);
				this.frame = { ...part, chunks: new Map(), size: 0 };
				this.timer = setTimeout(() => { this.frame = null; this.onDrop('expired'); }, 1500);
			}
			const frame = this.frame;
			if (frame.count !== part.count || frame.capturedAt !== part.capturedAt) return this.onDrop('inconsistent');
			if (!frame.chunks.has(part.index)) { frame.chunks.set(part.index, part.data); frame.size += part.data.length; }
			if (frame.size > MAX_FRAME) { this.frame = null; clearTimeout(this.timer); return this.onDrop('frame_size'); }
			if (frame.chunks.size !== part.count) return;
			clearTimeout(this.timer); this.frame = null; this.sequence = frame.sequence;
			const data = Array.from({ length: frame.count }, (_, index) => frame.chunks.get(index)).join('');
			this.onFrame({ data, mimeType: 'image/jpeg', source: 'phone', sequence: frame.sequence, capturedAt: frame.capturedAt, sessionId: frame.sessionId });
		}
	}
	class CameraSender {
		constructor(options) {
			this.options = options; this.generation = 0; this.sequence = 0; this.facing = 'environment'; this.stream = null;
			this.video = options.video; this.canvas = document.createElement('canvas'); this.enabled = false;
			document.addEventListener('visibilitychange', () => { this.updateStatus(); });
			window.addEventListener('pagehide', () => this.stop());
		}
		updateStatus(message) {
			const state = this.options.state();
			this.options.status(message || (!this.enabled ? 'Kamera kapalı' : document.hidden ? 'Görüntü paylaşımı arka planda duraklatıldı' : state.printerObservation ? 'Yazıcı görüntüsü inceleniyor; telefon aktarımı bekliyor' : !state.ready ? 'Bağlantı bekleniyor; görüntü gönderilmiyor' : 'Kamera paylaşılıyor'));
		}
		async start() {
			this.stop();
			const generation = ++this.generation;
			if (!this.options.state().supported) { this.updateStatus('Bu masaüstü kamera paylaşımını desteklemiyor'); return; }
			try {
				const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: this.facing }, width: { ideal: 1024 }, height: { ideal: 768 } }, audio: false });
				if (generation !== this.generation || !this.options.state().supported) { stream.getTracks().forEach(track => track.stop()); return; }
				this.stream = stream; this.enabled = true; this.video.srcObject = stream; this.video.hidden = false;
				await this.video.play(); this.updateStatus(); void this.tick(generation);
			} catch { this.stop(); this.updateStatus('Kamera açılamadı. Sesli görüşme devam edebilir.'); }
		}
		stop() { this.generation++; clearTimeout(this.timer); this.enabled = false; this.stream?.getTracks().forEach(track => track.stop()); this.stream = null; this.video.srcObject = null; this.video.hidden = true; this.updateStatus(); }
		async switchCamera() { this.facing = this.facing === 'environment' ? 'user' : 'environment'; if (this.enabled) await this.start(); }
		async tick(generation) {
			if (generation !== this.generation || !this.enabled) return;
			try {
				const state = this.options.state(), channel = state.channel;
				this.updateStatus();
				if (document.hidden || !state.ready || state.printerObservation || channel?.readyState !== 'open'
					|| channel.bufferedAmount > 0 || state.audioBuffered > 16000 || !this.video.videoWidth) return;
				const ratio = Math.min(1, 1024 / Math.max(this.video.videoWidth, this.video.videoHeight));
				this.canvas.width = Math.round(this.video.videoWidth * ratio); this.canvas.height = Math.round(this.video.videoHeight * ratio);
				this.canvas.getContext('2d').drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
				let data = this.canvas.toDataURL('image/jpeg', 0.65).split(',')[1];
				if (data.length > 180000) data = this.canvas.toDataURL('image/jpeg', 0.35).split(',')[1];
				if (data.length > 180000 || generation !== this.generation) return;
				const count = Math.ceil(data.length / CHUNK), sequence = ++this.sequence, capturedAt = new Date().toISOString();
				for (let index = 0; index < count; index++) {
					if (channel.bufferedAmount > 220000 || this.options.state().audioBuffered > 16000) break;
					channel.send(JSON.stringify({ source: 'phone', sessionId: state.sessionId, mimeType: 'image/jpeg', sequence, capturedAt, index, count, data: data.slice(index * CHUNK, (index + 1) * CHUNK) }));
				}
			} catch { this.updateStatus('Görüntü aktarımı bekliyor'); }
			finally { if (generation === this.generation && this.enabled) this.timer = setTimeout(() => void this.tick(generation), 1000); }
		}
	}
	const api = { VERSION, CHANNEL, FrameReceiver, CameraSender };
	if (typeof module !== 'undefined' && module.exports) module.exports = api;
	root.JumperLiveVideo = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
