/**
 * Offline daily quotes. Every line here is original writing for Daily Sync
 * (no third-party copyrighted text), provided in English and Hindi.
 */
import type { DateKey } from '@/lib/dates';
import type { Language } from '@/store/preferences';

export interface Quote {
  id: string;
  en: string;
  hi: string;
}

export const QUOTES: readonly Quote[] = [
  { id: 'q01', en: 'Small steps, taken daily, quietly become a different life.', hi: 'रोज़ उठाए गए छोटे क़दम चुपचाप एक नई ज़िंदगी बन जाते हैं।' },
  { id: 'q02', en: 'You do not need a perfect day. You need an honest one.', hi: 'आपको परफ़ेक्ट दिन नहीं, एक ईमानदार दिन चाहिए।' },
  { id: 'q03', en: 'Plan the morning, protect the afternoon, reflect at night.', hi: 'सुबह योजना बनाइए, दोपहर को बचाइए, रात को सोचिए।' },
  { id: 'q04', en: 'Consistency is just kindness to your future self, repeated.', hi: 'निरंतरता, अपने भविष्य के प्रति बार-बार दिखाई गई दयालुता है।' },
  { id: 'q05', en: 'Finish one thing well before you start three things fast.', hi: 'तीन काम जल्दी शुरू करने से पहले एक काम अच्छे से पूरा कीजिए।' },
  { id: 'q06', en: 'Rest is part of the plan, not a break from it.', hi: 'आराम योजना का हिस्सा है, उससे छुट्टी नहीं।' },
  { id: 'q07', en: 'A streak is built one ordinary Tuesday at a time.', hi: 'लगातार सफलता एक-एक साधारण दिन से बनती है।' },
  { id: 'q08', en: 'What you repeat, you become. Choose the repetition.', hi: 'जो आप दोहराते हैं, वही आप बनते हैं। दोहराव सोच-समझकर चुनिए।' },
  { id: 'q09', en: 'Clarity comes from writing it down, not from thinking harder.', hi: 'स्पष्टता लिखने से आती है, ज़्यादा सोचने से नहीं।' },
  { id: 'q10', en: 'Missed yesterday? Today is still fully yours.', hi: 'कल छूट गया? आज अब भी पूरा आपका है।' },
  { id: 'q11', en: 'Your calendar shows your priorities more honestly than your words.', hi: 'आपका कैलेंडर आपकी प्राथमिकताएँ आपके शब्दों से ज़्यादा सच बताता है।' },
  { id: 'q12', en: 'Progress you can see is progress you will continue.', hi: 'जो प्रगति दिखती है, वही जारी रहती है।' },
  { id: 'q13', en: 'Begin before you feel ready. Readiness arrives on the way.', hi: 'तैयार महसूस करने से पहले शुरू कीजिए। तैयारी रास्ते में आ जाती है।' },
  { id: 'q14', en: 'Focus is saying a gentle no to almost everything.', hi: 'एकाग्रता का मतलब है लगभग हर चीज़ को विनम्रता से ना कहना।' },
  { id: 'q15', en: 'Do the hard task first; let the rest of the day feel light.', hi: 'मुश्किल काम पहले कीजिए; बाक़ी दिन हल्का लगेगा।' },
  { id: 'q16', en: 'Water, movement, sleep. The quiet foundations of a strong mind.', hi: 'पानी, व्यायाम, नींद — मज़बूत मन की शांत नींव।' },
  { id: 'q17', en: 'A good day is planned the night before.', hi: 'अच्छा दिन एक रात पहले तय होता है।' },
  { id: 'q18', en: 'Celebrate the small wins; they are the big ones in disguise.', hi: 'छोटी जीतों का जश्न मनाइए; वे बड़ी जीतें ही हैं, बस भेष बदलकर।' },
  { id: 'q19', en: 'You are allowed to grow slowly. You are not allowed to quit on yourself.', hi: 'धीरे बढ़ना ठीक है, बस ख़ुद से हार मत मानिए।' },
  { id: 'q20', en: 'Time is not found. It is made, one block at a time.', hi: 'समय मिलता नहीं, बनाया जाता है — एक-एक हिस्से में।' },
  { id: 'q21', en: 'Discipline today is freedom tomorrow.', hi: 'आज का अनुशासन, कल की आज़ादी है।' },
  { id: 'q22', en: 'Notice how you feel. It is data, not a verdict.', hi: 'ध्यान दीजिए आप कैसा महसूस करते हैं। यह जानकारी है, फ़ैसला नहीं।' },
  { id: 'q23', en: 'Twenty focused minutes beat two distracted hours.', hi: 'बीस मिनट की एकाग्रता, दो घंटे के भटकाव से बेहतर है।' },
  { id: 'q24', en: 'Make it easy to start and hard to forget.', hi: 'शुरू करना आसान और भूलना मुश्किल बनाइए।' },
  { id: 'q25', en: 'Your future is written in today’s small decisions.', hi: 'आपका भविष्य आज के छोटे फ़ैसलों में लिखा जाता है।' },
  { id: 'q26', en: 'Gratitude turns what you have into enough.', hi: 'कृतज्ञता, जो आपके पास है उसे काफ़ी बना देती है।' },
  { id: 'q27', en: 'Show up, even at half strength. Half is not zero.', hi: 'आधी ताक़त से ही सही, पर आइए। आधा, शून्य नहीं होता।' },
  { id: 'q28', en: 'Calm is a skill. Practise it like any other.', hi: 'शांति एक कौशल है। इसे भी अभ्यास से सीखिए।' },
  { id: 'q29', en: 'The best reminder is the habit that no longer needs one.', hi: 'सबसे अच्छा रिमाइंडर वह आदत है जिसे अब रिमाइंडर की ज़रूरत नहीं।' },
  { id: 'q30', en: 'Measure your days by what you finished, not what you worried about.', hi: 'अपने दिन उस से मापिए जो पूरा किया, उससे नहीं जिसकी चिंता की।' },
  { id: 'q31', en: 'Every expert was once a beginner who kept a schedule.', hi: 'हर विशेषज्ञ कभी एक शुरुआती था जिसने अपनी दिनचर्या निभाई।' },
  { id: 'q32', en: 'Leave today a little better organised than you found it.', hi: 'आज को थोड़ा और व्यवस्थित छोड़कर जाइए।' },
  { id: 'q33', en: 'Momentum loves a clear next step.', hi: 'गति को साफ़ अगला क़दम पसंद है।' },
  { id: 'q34', en: 'Be patient with the process and proud of the progress.', hi: 'प्रक्रिया के साथ धैर्य रखिए, प्रगति पर गर्व कीजिए।' },
  { id: 'q35', en: 'One page, one rep, one glass of water. Begin there.', hi: 'एक पन्ना, एक रेप, एक गिलास पानी — वहीं से शुरू कीजिए।' },
  { id: 'q36', en: 'The day is long enough for what truly matters.', hi: 'जो सच में मायने रखता है, उसके लिए दिन काफ़ी लंबा है।' },
  { id: 'q37', en: 'Your energy is a resource. Spend it on purpose.', hi: 'आपकी ऊर्जा एक संसाधन है। उसे सोच-समझकर ख़र्च कीजिए।' },
  { id: 'q38', en: 'Reflection turns experience into wisdom.', hi: 'चिंतन अनुभव को समझदारी में बदल देता है।' },
  { id: 'q39', en: 'Stay in sync with what you said mattered.', hi: 'जिसे आपने ज़रूरी कहा, उसके साथ तालमेल बनाए रखिए।' },
  { id: 'q40', en: 'Tomorrow will thank you for tonight’s five minutes of planning.', hi: 'आज रात के पाँच मिनट की योजना के लिए कल आपको धन्यवाद देगा।' },
];

function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

/** Deterministic quote for a date, avoiding recently shown ones where possible. */
export function quoteForDate(date: DateKey, recentIds: readonly string[] = []): Quote {
  const recent = new Set(recentIds);
  const pool = QUOTES.filter((quote) => !recent.has(quote.id));
  const source = pool.length > 0 ? pool : QUOTES;
  return source[hash(date) % source.length] as Quote;
}

export function quoteText(quote: Quote, language: Language): string {
  return language === 'hi' ? quote.hi : quote.en;
}
