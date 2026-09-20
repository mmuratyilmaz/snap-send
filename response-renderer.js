/* Shared by the extension host, desktop webview and Mobile Companion. */
(function (root, factory) {
	if (typeof module === 'object' && module.exports) {
		const window = new (require('jsdom').JSDOM)('').window;
		module.exports = factory(window, require('./response-vendor/marked.cjs'), require('dompurify')(window));
	} else root.JumperResponse = factory(root, root.marked, root.DOMPurify);
})(typeof globalThis === 'object' ? globalThis : this, function (window, marked, purify) {
	'use strict';
	const words = {
		en: { copy: 'Copy', desktop: 'Available on desktop', retry: 'Retry response', unavailable: 'The response could not be prepared. You can retry.' },
		tr: { copy: 'Kopyala', desktop: 'Bilgisayarda kullanılabilir', retry: 'Cevabı yeniden hazırla', unavailable: 'Yanıt hazırlanamadı. Yeniden deneyebilirsiniz.' },
		de: { copy: 'Kopieren', desktop: 'Am Computer verfügbar', retry: 'Antwort erneut erstellen', unavailable: 'Die Antwort konnte nicht erstellt werden. Versuchen Sie es erneut.' },
		es: { copy: 'Copiar', desktop: 'Disponible en el ordenador', retry: 'Reintentar respuesta', unavailable: 'No se pudo preparar la respuesta. Puede volver a intentarlo.' },
		ar: { copy: 'نسخ', desktop: 'متاح على الكمبيوتر', retry: 'إعادة إعداد الرد', unavailable: 'تعذر إعداد الرد. يمكنك المحاولة مجددًا.' },
		ja: { copy: 'コピー', desktop: 'パソコンで利用できます', retry: '回答を再作成', unavailable: '回答を作成できませんでした。再試行できます。' }
	};
	const controlKeys = ['preview','stopPreview','compile','upload','fixCompile','serialOpen','serialClose','serialRestart','selectPort','identify','approve','reject'];
	const controlWords = {
		tr: ['Önizlemeyi aç','Önizlemeyi durdur','Derle','Karta yükle','Düzelt ve derle','Seri monitörü aç','Seri monitörü kapat','Seri monitörü yeniden aç','Bağlantı noktasını seç','Cihazı tanı','Onayla','Reddet'],
		en: ['Open preview','Stop preview','Compile','Upload to board','Fix and compile','Open serial monitor','Close serial monitor','Restart serial monitor','Select port','Identify device','Approve','Reject'],
		de: ['Vorschau öffnen','Vorschau stoppen','Kompilieren','Auf Board hochladen','Korrigieren und kompilieren','Seriellen Monitor öffnen','Seriellen Monitor schließen','Seriellen Monitor neu starten','Port auswählen','Gerät erkennen','Bestätigen','Ablehnen'],
		es: ['Abrir vista previa','Detener vista previa','Compilar','Subir a la placa','Corregir y compilar','Abrir monitor serie','Cerrar monitor serie','Reiniciar monitor serie','Seleccionar puerto','Identificar dispositivo','Aprobar','Rechazar'],
		ar: ['فتح المعاينة','إيقاف المعاينة','ترجمة الشيفرة','رفع إلى اللوحة','إصلاح وترجمة','فتح المراقب التسلسلي','إغلاق المراقب التسلسلي','إعادة تشغيل المراقب التسلسلي','اختيار المنفذ','التعرف على الجهاز','موافقة','رفض'],
		ja: ['プレビューを開く','プレビューを停止','コンパイル','ボードへ書き込み','修正してコンパイル','シリアルモニターを開く','シリアルモニターを閉じる','シリアルモニターを再起動','ポートを選択','デバイスを識別','承認','拒否']
	};
	for (const [language, values] of Object.entries(controlWords)) values.forEach((value,index)=>{words[language][controlKeys[index]]=value;});
	// Existing card labels use application-locale fallback until that particular key
	// has a translation. These exact UI keys never rewrite model-authored prose.
	const cardLabels = {
		'Derleme Baslatilamadi':'Compilation could not start', 'Hedef Kart Secimi Gerekli':'Select a target board', 'Gecerli Hedef Bulunamadi':'No valid target',
		'Derleme Basarili':'Compiled', 'Derleme Basarisiz':'Compilation failed', 'Derle ve Yukle Baslatilamadi':'Compile and upload could not start',
		'Yukleme Baslatilamadi':'Upload could not start', 'Firmware Hedef Topolojisi Tutarsiz':'Firmware targets are inconsistent',
		'Port Baglama Gerekli':'Select a port', 'Yukleme Icin Net Baglama Gerekli':'Confirm the upload connection',
		'Derle ve Yukle Basarisiz':'Compile and upload incomplete', 'Derlendi ve Yuklendi':'Compiled and uploaded', 'Yukleme Basarili':'Uploaded',
		'Yukleme Basarisiz':'Upload failed', 'Seri Monitor Kapatildi':'Serial monitor closed', 'Bekleyen Build Hatasi Yok':'No pending build error',
		'Duzeltildi ve Derlendi':'Repaired and compiled', 'Fix Sonrasi Derleme Hala Basarisiz':'Compilation still failed after repair',
		'Desteklenmeyen Firmware Operasyonu':'Unsupported firmware operation', 'Bağlantı toparlanıyor':'Connection recovering',
		'Seçim bekliyor':'Awaiting selection', 'Açıklama bekliyor':'Awaiting clarification', 'Onay bekliyor':'Awaiting approval',
		'Sepete Git':'Open basket', 'Sepet hazir':'Basket prepared', 'Sipariş':'Order', 'Sipariş Kodu':'Order code', 'Sipariş Tarihi':'Order date',
		'Toplam Tutar':'Total amount', 'Ürün Sayısı':'Item count', 'Toplam':'Total', 'Sepet':'Basket',
		'Yeni Sipariş':'New order', 'İptal Edildi':'Cancelled', 'Teslim Edildi':'Delivered', 'Kargoya Verildi':'Shipped', 'Hazırlanıyor':'Preparing',
		'Onaylandı':'Confirmed', 'Sipariş Alındı':'Order received', 'Sipariş Alınacak':'Order pending', 'Onay Bekliyor':'Awaiting confirmation',
		'Hazırlandı':'Prepared', 'Hazırlanacak':'Preparation pending', 'Kargoya Verilecek':'Shipment pending', 'Teslim Edilecek':'Delivery pending',
		'Hedefler':'Targets', 'Ortam':'Environment', 'Kart':'Board', 'Port':'Port', 'Ilk hata':'First error', 'İlk hata':'First error'
	};
	for (const [source, english] of Object.entries(cardLabels)) { words.tr['card:' + source] = source; words.en['card:' + source] = english; }
	words.tr.details = 'Teknik ayrıntılar'; words.en.details = 'Technical details';
	for (const [language, values] of Object.entries({ tr:['Yeniden dene','İptal et'], en:['Retry','Cancel'], de:['Erneut versuchen','Abbrechen'], es:['Reintentar','Cancelar'], ar:['إعادة المحاولة','إلغاء'], ja:['再試行','キャンセル'] })) { words[language].retryTask = values[0]; words[language].cancel = values[1]; }
	function label(key, language, fallbackLanguage) { return words[String(language || '').split('-')[0]]?.[key] || words[String(fallbackLanguage || 'en').split('-')[0]]?.[key] || words.en[key] || key; }
	function localizeCard(root, language, fallbackLanguage) {
		for (const node of root.querySelectorAll('.jumper-firmware-card > strong,.jumper-firmware-card > ul > li,.jumper-pending-badge,.nexmaker-cart-button,.cart-summary-subtitle,.cart-summary-total,.nexmaker-cart-total,.cart-summary-count,.order-title,.order-subtitle,.order-meta-line,.order-step-label')) {
			if (node.children.length) continue;
			const value = node.textContent, colon = value.indexOf(':');
			const key = colon === -1 ? value.trim() : value.slice(0, colon).trim();
			if (Object.hasOwn(cardLabels, key)) node.textContent = label('card:' + key, language, fallbackLanguage) + (colon === -1 ? '' : value.slice(colon));
		}
		// Exact operational values and logs stay available; the editor explains them.
		for (const list of root.querySelectorAll('.jumper-firmware-card > ul')) {
			const details = window.document.createElement('details'), summary = window.document.createElement('summary');
			summary.textContent = label('details', language, fallbackLanguage); list.replaceWith(details); details.append(summary, list);
		}
	}
	function commandLabel(command, args, language, fallbackLanguage) {
		const key = { 'jumper-chat.runUiPreview':'preview','jumper-chat.stopUiPreview':'stopPreview','jumper-chat.firmwareCompile':'compile',
			'jumper-chat.firmwareUpload':'upload','jumper-chat.firmwareFixAndRebuild':'fixCompile','jumper-chat.firmwareOpenSerialMonitor':'serialOpen',
			'jumper-chat.firmwareCloseSerialMonitor':'serialClose','jumper-chat.firmwareRestartSerialMonitor':'serialRestart',
			'jumper-chat.firmwareSelectPort':'selectPort','jumper-chat.firmwareIdentifyDevice':'identify','jumper-chat.retryFinalResponse':'retry' }[command];
		const resolution = Array.isArray(args) ? args[0] : args;
		const choice = command === 'jumper-chat.resolvePendingInteraction' && ['approve','reject'].includes(resolution?.decision) ? resolution.decision : key;
		return choice ? label(choice, language, fallbackLanguage) : null;
	}
	const escape = value => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	const parser = new marked.Marked({ gfm: true, breaks: false, renderer: {
		html(token) { return escape(token.text); },
		link(token) {
			const target = String(token.href || '');
			const external = /^(https?:|mailto:)/i.test(target);
			const local = target && !target.startsWith('//') && (!/^[a-z][a-z0-9+.-]*:/i.test(target) || /^[a-z]:[\\/]/i.test(target));
			const text = this.parser.parseInline(token.tokens);
			if (!external && !local) return text;
			return '<a href="' + (external ? escape(target) : '#') + '" data-response-link="' + escape(target) + '">' + text + '</a>';
		}
	} });
	const tags = ['p', 'br', 'strong', 'em', 'del', 'a', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'blockquote', 'pre', 'code', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'span', 'div', 'details', 'summary', 'section', 'button', 'small', 'label', 'input', 'svg', 'path'];
	function sanitize(html, component) {
		return purify.sanitize(String(html || ''), { ALLOWED_TAGS: tags,
			ALLOWED_ATTR: ['href','src','alt','title','class','open','type','value','min','max','step','disabled','tabindex','role','colspan','rowspan','dir','lang','viewBox','d','stroke','fill','width','height','data-response-link'],
			ALLOW_DATA_ATTR: !!component, ALLOW_ARIA_ATTR: true, FORBID_TAGS: component ? [] : ['button','input'],
			FORBID_ATTR: ['style'], RETURN_TRUSTED_TYPE: false });
	}
	function documentFor(html) { const el = window.document.createElement('div'); el.innerHTML = html; return el; }
	function markdown(value) { return sanitize(parser.parse(String(value || '')), false); }
	function layoutIssues(value) {
		let escapedLayout = false;
		// Inspect prose tokens only. Literal escape sequences in code remain exact.
		parser.walkTokens(parser.lexer(String(value || '')), token => {
			if (token.type === 'text' && !token.tokens && (token.text.includes('\\n\\n') || token.text.includes('\\n- ') || token.text.includes('\\n# '))) escapedLayout = true;
		});
		return escapedLayout ? ['Use real Markdown line breaks, not literal backslash-n layout markers. Preserve intentional code escapes.'] : [];
	}
	function legacy(value) { return sanitize(value, true); }
	function text(value) {
		const el = documentFor(legacy(value));
		for (const node of el.querySelectorAll('p,li,pre,h1,h2,h3,h4,section,div,summary,tr')) node.appendChild(window.document.createTextNode('\n'));
		return el.textContent.trim();
	}
	function speech(value) {
		const el = documentFor(legacy(value));
		for (const node of el.querySelectorAll('button,input,svg,pre,[aria-hidden="true"]')) node.remove();
		return text(el.innerHTML);
	}
	function render(envelope, mobile) {
		const components = new Map((envelope.components || []).map(item => [item.id, item]));
		return (envelope.sections || []).map(section => {
			if (section.kind === 'markdown') return '<div class="jumper-response-prose" dir="auto">' + markdown(section.markdown) + '</div>';
			const component = components.get(section.componentId);
			if (!component) return '';
			const el = documentFor(legacy(component.html));
			if (mobile) for (const button of el.querySelectorAll('[data-open-url]')) {
				const url = button.getAttribute('data-open-url');
				if (!/^https?:/i.test(url || '')) continue;
				const link = window.document.createElement('a'); link.href = url; link.innerHTML = button.innerHTML;
				if (button.getAttribute('aria-label')) link.setAttribute('aria-label', button.getAttribute('aria-label'));
				link.className = button.className; link.target = '_blank'; link.rel = 'noopener noreferrer'; button.replaceWith(link);
			}
			if (mobile) for (const button of el.querySelectorAll('button,[data-command], [data-printer-photo]')) {
				button.setAttribute('disabled', ''); button.setAttribute('aria-disabled', 'true');
				button.title = label('desktop', envelope.language, envelope.uiLanguage);
			}
			return '<div class="jumper-response-component" data-component-id="' + escape(component.id) + '">' + el.innerHTML + '</div>';
		}).join('\n');
	}
	function mount(target, envelope, options) {
		const settings = options || {};
		target.innerHTML = render(envelope, settings.mobile);
		target.classList.add('jumper-response'); target.setAttribute('dir', 'auto');
		for (const link of target.querySelectorAll('[data-response-link]')) {
			const value = link.getAttribute('data-response-link');
			if (settings.mobile && !/^(https?:|mailto:)/i.test(value)) {
				link.setAttribute('aria-disabled', 'true'); link.title = label('desktop', envelope.language, envelope.uiLanguage);
				link.addEventListener('click', event => event.preventDefault());
			} else if (settings.openLink) link.addEventListener('click', event => { event.preventDefault(); settings.openLink(value); });
			else { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
		}
		for (const block of target.querySelectorAll('.jumper-response-prose pre')) {
			const code = block.querySelector('code'); if (!code) continue;
			const button = window.document.createElement('button'); button.type = 'button'; button.className = 'jumper-code-copy';
			button.textContent = label('copy', envelope.language, envelope.uiLanguage);
			button.addEventListener('click', () => window.navigator.clipboard?.writeText(code.textContent)); block.prepend(button);
		}
	}
	return { markdown, layoutIssues, legacy, text, speech, label, commandLabel, localizeCard, render, mount, documentFor, escape };
});
