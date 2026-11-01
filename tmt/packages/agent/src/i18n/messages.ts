import type { Language } from "@tmt/contracts";

export interface SpokenMessages {
  readonly acknowledgement: string;
  readonly greeting: string;
  readonly greetingWithRecording: string;
  readonly handoff: string;
}

// Safety copy is deliberately explicit. pa/hi/es remain gated on native-speaker review.
export const SPOKEN_MESSAGES: Readonly<Record<Language, SpokenMessages>> = {
  en: {
    acknowledgement:
      "I heard you. I am here to help. First, are you and your truck safely out of a travel lane?",
    greeting:
      "Hello. I am TMT's AI dispatcher. Press 0 at any time for a human dispatcher. First, are you and your truck safely out of a travel lane?",
    greetingWithRecording:
      "Hello. I am TMT's AI dispatcher. This call is recorded for service and quality. By continuing, you consent to recording. Press 0 at any time for a human dispatcher. First, are you and your truck safely out of a travel lane?",
    handoff: "I am connecting you to a human dispatcher now.",
  },
  pa: {
    acknowledgement:
      "ਮੈਂ ਤੁਹਾਡੀ ਗੱਲ ਸੁਣੀ ਹੈ। ਮੈਂ ਮਦਦ ਲਈ ਇੱਥੇ ਹਾਂ। ਪਹਿਲਾਂ, ਕੀ ਤੁਸੀਂ ਅਤੇ ਤੁਹਾਡਾ ਟਰੱਕ ਚੱਲਦੀ ਟ੍ਰੈਫਿਕ ਲੇਨ ਤੋਂ ਸੁਰੱਖਿਅਤ ਬਾਹਰ ਹੋ?",
    greeting:
      "ਸਤ ਸ੍ਰੀ ਅਕਾਲ। ਮੈਂ TMT ਦੀ AI ਡਿਸਪੈਚਰ ਹਾਂ। ਮਨੁੱਖੀ ਡਿਸਪੈਚਰ ਨਾਲ ਗੱਲ ਕਰਨ ਲਈ ਕਿਸੇ ਵੀ ਵੇਲੇ 0 ਦਬਾਓ। ਪਹਿਲਾਂ, ਕੀ ਤੁਸੀਂ ਅਤੇ ਤੁਹਾਡਾ ਟਰੱਕ ਚੱਲਦੀ ਟ੍ਰੈਫਿਕ ਲੇਨ ਤੋਂ ਸੁਰੱਖਿਅਤ ਬਾਹਰ ਹੋ?",
    greetingWithRecording:
      "ਸਤ ਸ੍ਰੀ ਅਕਾਲ। ਮੈਂ TMT ਦੀ AI ਡਿਸਪੈਚਰ ਹਾਂ। ਇਹ ਕਾਲ ਸੇਵਾ ਅਤੇ ਗੁਣਵੱਤਾ ਲਈ ਰਿਕਾਰਡ ਕੀਤੀ ਜਾਂਦੀ ਹੈ। ਜਾਰੀ ਰੱਖ ਕੇ ਤੁਸੀਂ ਰਿਕਾਰਡਿੰਗ ਲਈ ਸਹਿਮਤੀ ਦਿੰਦੇ ਹੋ। ਮਨੁੱਖੀ ਡਿਸਪੈਚਰ ਨਾਲ ਗੱਲ ਕਰਨ ਲਈ ਕਿਸੇ ਵੀ ਵੇਲੇ 0 ਦਬਾਓ। ਪਹਿਲਾਂ, ਕੀ ਤੁਸੀਂ ਅਤੇ ਤੁਹਾਡਾ ਟਰੱਕ ਚੱਲਦੀ ਟ੍ਰੈਫਿਕ ਲੇਨ ਤੋਂ ਸੁਰੱਖਿਅਤ ਬਾਹਰ ਹੋ?",
    handoff: "ਮੈਂ ਹੁਣ ਤੁਹਾਨੂੰ ਮਨੁੱਖੀ ਡਿਸਪੈਚਰ ਨਾਲ ਜੋੜ ਰਹੀ ਹਾਂ।",
  },
  hi: {
    acknowledgement:
      "मैंने आपकी बात सुनी। मैं मदद के लिए यहाँ हूँ। पहले, क्या आप और आपका ट्रक चलती ट्रैफ़िक लेन से सुरक्षित बाहर हैं?",
    greeting:
      "नमस्ते। मैं TMT की AI डिस्पैचर हूँ। किसी इंसानी डिस्पैचर से बात करने के लिए किसी भी समय 0 दबाएँ। पहले, क्या आप और आपका ट्रक चलती ट्रैफ़िक लेन से सुरक्षित बाहर हैं?",
    greetingWithRecording:
      "नमस्ते। मैं TMT की AI डिस्पैचर हूँ। यह कॉल सेवा और गुणवत्ता के लिए रिकॉर्ड की जाती है। जारी रखकर आप रिकॉर्डिंग के लिए सहमति देते हैं। किसी इंसानी डिस्पैचर से बात करने के लिए किसी भी समय 0 दबाएँ। पहले, क्या आप और आपका ट्रक चलती ट्रैफ़िक लेन से सुरक्षित बाहर हैं?",
    handoff: "मैं अब आपको एक इंसानी डिस्पैचर से जोड़ रही हूँ।",
  },
  es: {
    acknowledgement:
      "Le escuché. Estoy aquí para ayudarle. Primero, ¿usted y su camión están fuera de un carril de circulación y en un lugar seguro?",
    greeting:
      "Hola. Soy la despachadora de inteligencia artificial de TMT. Presione 0 en cualquier momento para hablar con una persona. Primero, ¿usted y su camión están fuera de un carril de circulación y en un lugar seguro?",
    greetingWithRecording:
      "Hola. Soy la despachadora de inteligencia artificial de TMT. Esta llamada se graba para servicio y calidad. Al continuar, usted acepta la grabación. Presione 0 en cualquier momento para hablar con una persona. Primero, ¿usted y su camión están fuera de un carril de circulación y en un lugar seguro?",
    handoff: "Ahora le conectaré con una persona del equipo de despacho.",
  },
};

export const BCP47_BY_LANGUAGE = {
  en: "en-US",
  pa: "pa-IN",
  hi: "hi-IN",
  es: "es-US",
} as const satisfies Readonly<Record<Language, string>>;
