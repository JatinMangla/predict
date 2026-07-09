// Meanings for every yoga/dosha key emitted by the detector.

import type { Bi } from "./core";

export const YOGA_MEANINGS: Record<string, { name: Bi; meaning: Bi }> = {
  gajakesari: {
    name: { en: "Gajakesari Yoga", hi: "गजकेसरी योग" },
    meaning: {
      en: "Jupiter in a kendra from the Moon grants wisdom, reputation, lasting prosperity and respect from authority.",
      hi: "चंद्रमा से केंद्र में गुरु — बुद्धि, कीर्ति, स्थायी समृद्धि और समाज में सम्मान देता है।",
    },
  },
  budhaditya: {
    name: { en: "Budhaditya Yoga", hi: "बुधादित्य योग" },
    meaning: {
      en: "Sun and Mercury together create sharp intellect, administrative skill and success in analytical work.",
      hi: "सूर्य-बुध की युति तीव्र बुद्धि, प्रशासनिक क्षमता और विश्लेषणात्मक कार्यों में सफलता देती है।",
    },
  },
  "chandra-mangal": {
    name: { en: "Chandra-Mangal Yoga", hi: "चंद्र-मंगल योग" },
    meaning: {
      en: "Moon-Mars combination gives earning power, enterprise and financial drive.",
      hi: "चंद्र-मंगल योग अर्जन शक्ति, उद्यम और आर्थिक प्रगति देता है।",
    },
  },
  ruchaka: {
    name: { en: "Ruchaka Yoga (Panch Mahapurusha)", hi: "रुचक योग (पंच महापुरुष)" },
    meaning: {
      en: "Mars strong in a kendra — courage, physical power, command and fame through bold action.",
      hi: "केंद्र में बली मंगल — साहस, शारीरिक बल, नेतृत्व और पराक्रम से कीर्ति।",
    },
  },
  bhadra: {
    name: { en: "Bhadra Yoga (Panch Mahapurusha)", hi: "भद्र योग (पंच महापुरुष)" },
    meaning: {
      en: "Mercury strong in a kendra — brilliant intellect, eloquence and business acumen.",
      hi: "केंद्र में बली बुध — प्रखर बुद्धि, वाक्पटुता और व्यापार कौशल।",
    },
  },
  hamsa: {
    name: { en: "Hamsa Yoga (Panch Mahapurusha)", hi: "हंस योग (पंच महापुरुष)" },
    meaning: {
      en: "Jupiter strong in a kendra — righteousness, respect, spiritual wisdom and good fortune.",
      hi: "केंद्र में बली गुरु — धर्मनिष्ठा, सम्मान, आध्यात्मिक ज्ञान और सौभाग्य।",
    },
  },
  malavya: {
    name: { en: "Malavya Yoga (Panch Mahapurusha)", hi: "मालव्य योग (पंच महापुरुष)" },
    meaning: {
      en: "Venus strong in a kendra — beauty, luxury, artistic talent and marital happiness.",
      hi: "केंद्र में बली शुक्र — सौंदर्य, वैभव, कला-प्रतिभा और वैवाहिक सुख।",
    },
  },
  sasa: {
    name: { en: "Sasa Yoga (Panch Mahapurusha)", hi: "शश योग (पंच महापुरुष)" },
    meaning: {
      en: "Saturn strong in a kendra — authority over others, organisational power and lasting position.",
      hi: "केंद्र में बली शनि — जनों पर अधिकार, संगठन शक्ति और स्थायी पद।",
    },
  },
  "raja-yoga": {
    name: { en: "Raja Yoga", hi: "राज योग" },
    meaning: {
      en: "A kendra lord united with a trikona lord — rise in status, power and fortune, especially during their dashas.",
      hi: "केंद्रेश-त्रिकोणेश का संबंध — पद, शक्ति और भाग्य में वृद्धि, विशेषकर इनकी दशाओं में।",
    },
  },
  "dhana-yoga": {
    name: { en: "Dhana Yoga", hi: "धन योग" },
    meaning: {
      en: "Wealth lords combine — strong earning and accumulation capacity.",
      hi: "धनेश-लाभेश का संबंध — अर्जन और संचय की प्रबल क्षमता।",
    },
  },
  "vipreet-harsha": {
    name: { en: "Harsha Vipreet Raja Yoga", hi: "हर्ष विपरीत राज योग" },
    meaning: {
      en: "The 6th lord in a dusthana turns obstacles into victory over enemies and good health.",
      hi: "षष्ठेश की दुःस्थान स्थिति शत्रु-विजय और स्वास्थ्य में बाधाओं को वरदान बना देती है।",
    },
  },
  "vipreet-sarala": {
    name: { en: "Sarala Vipreet Raja Yoga", hi: "सरल विपरीत राज योग" },
    meaning: {
      en: "The 8th lord in a dusthana grants fearlessness, longevity and gains from crises.",
      hi: "अष्टमेश की दुःस्थान स्थिति निर्भयता, दीर्घायु और संकटों से लाभ देती है।",
    },
  },
  "vipreet-vimala": {
    name: { en: "Vimala Vipreet Raja Yoga", hi: "विमल विपरीत राज योग" },
    meaning: {
      en: "The 12th lord in a dusthana controls expenses and turns losses into independence.",
      hi: "व्ययेश की दुःस्थान स्थिति व्यय नियंत्रित कर हानि को स्वतंत्रता में बदलती है।",
    },
  },
  "neecha-bhanga": {
    name: { en: "Neecha Bhanga Raja Yoga", hi: "नीच भंग राज योग" },
    meaning: {
      en: "A debilitated planet's weakness is cancelled — after early struggle it rises to give raja-yoga-like results.",
      hi: "नीच ग्रह की दुर्बलता भंग होती है — आरंभिक संघर्ष के बाद राजयोग तुल्य फल मिलते हैं।",
    },
  },
  kemadruma: {
    name: { en: "Kemadruma Dosha", hi: "केमद्रुम दोष" },
    meaning: {
      en: "A lonely Moon can bring emotional ups and downs and phases of isolation; strong company and routine are the remedy.",
      hi: "निर्बल एकाकी चंद्रमा भावनात्मक उतार-चढ़ाव और एकाकीपन दे सकता है; अच्छा संग और दिनचर्या उपाय हैं।",
    },
  },
  sunapha: {
    name: { en: "Sunapha Yoga", hi: "सुनफा योग" },
    meaning: {
      en: "Planets in the 2nd from the Moon — self-earned wealth and a capable mind.",
      hi: "चंद्रमा से द्वितीय में ग्रह — स्वअर्जित धन और सक्षम बुद्धि।",
    },
  },
  anapha: {
    name: { en: "Anapha Yoga", hi: "अनफा योग" },
    meaning: {
      en: "Planets in the 12th from the Moon — good health, character and renown.",
      hi: "चंद्रमा से द्वादश में ग्रह — उत्तम स्वास्थ्य, चरित्र और यश।",
    },
  },
  durudhara: {
    name: { en: "Durudhara Yoga", hi: "दुरुधरा योग" },
    meaning: {
      en: "Planets on both sides of the Moon — resources, vehicles and generous nature.",
      hi: "चंद्रमा के दोनों ओर ग्रह — साधन-संपन्नता, वाहन और उदार स्वभाव।",
    },
  },
  vesi: {
    name: { en: "Vesi Yoga", hi: "वेशि योग" },
    meaning: {
      en: "A planet in the 2nd from the Sun — balanced, truthful and steady nature.",
      hi: "सूर्य से द्वितीय में ग्रह — संतुलित, सत्यनिष्ठ और स्थिर स्वभाव।",
    },
  },
  vasi: {
    name: { en: "Vasi Yoga", hi: "वासि योग" },
    meaning: {
      en: "A planet in the 12th from the Sun — skilful, charitable and influential.",
      hi: "सूर्य से द्वादश में ग्रह — कुशल, दानी और प्रभावशाली।",
    },
  },
  ubhayachari: {
    name: { en: "Ubhayachari Yoga", hi: "उभयचरी योग" },
    meaning: {
      en: "Planets flank the Sun — an eloquent, prosperous and well-liked person.",
      hi: "सूर्य के दोनों ओर ग्रह — वाक्पटु, समृद्ध और लोकप्रिय व्यक्ति।",
    },
  },
  amala: {
    name: { en: "Amala Yoga", hi: "अमला योग" },
    meaning: {
      en: "A benefic in the 10th from Moon or lagna — spotless reputation and lasting fame.",
      hi: "चंद्र/लग्न से दशम में शुभ ग्रह — निष्कलंक कीर्ति और स्थायी यश।",
    },
  },
  adhi: {
    name: { en: "Adhi Yoga", hi: "अधि योग" },
    meaning: {
      en: "Benefics in 6th/7th/8th from the Moon — leadership, prosperity and defeat of opponents.",
      hi: "चंद्रमा से 6/7/8 में शुभ ग्रह — नेतृत्व, समृद्धि और विरोधियों पर विजय।",
    },
  },
  saraswati: {
    name: { en: "Saraswati Yoga", hi: "सरस्वती योग" },
    meaning: {
      en: "Jupiter, Venus and Mercury well placed — learning, arts, eloquence and scholarly fame.",
      hi: "गुरु, शुक्र, बुध की शुभ स्थिति — विद्या, कला, वाक्शक्ति और विद्वत्ता से यश।",
    },
  },
  lakshmi: {
    name: { en: "Lakshmi Yoga", hi: "लक्ष्मी योग" },
    meaning: {
      en: "Strong 9th lord and Venus — wealth, beauty and abundant fortune.",
      hi: "बली नवमेश और शुक्र — धन, सौंदर्य और प्रचुर सौभाग्य।",
    },
  },
  parivartana: {
    name: { en: "Parivartana Yoga", hi: "परिवर्तन योग" },
    meaning: {
      en: "Two planets exchange signs, strongly linking their houses — their significations support each other throughout life.",
      hi: "दो ग्रहों का राशि-परिवर्तन उनके भावों को प्रबल रूप से जोड़ता है — दोनों के फल परस्पर सहयोगी रहते हैं।",
    },
  },
  manglik: {
    name: { en: "Manglik (Mangal) Dosha", hi: "मांगलिक (मंगल) दोष" },
    meaning: {
      en: "Mars in a sensitive house can bring friction in married life. It is substantially reduced with age (after ~28), by a Manglik partner, or when Mars is dignified.",
      hi: "संवेदनशील भाव में मंगल वैवाहिक जीवन में टकराव दे सकता है। आयु (~28 के बाद), मांगलिक जीवनसाथी या बली मंगल से यह दोष काफी घट जाता है।",
    },
  },
  "kaal-sarp": {
    name: { en: "Kaal Sarp Dosha", hi: "काल सर्प दोष" },
    meaning: {
      en: "All planets hemmed between Rahu and Ketu — life moves in intense waves; delays followed by sudden breakthroughs. Devotion and patience are classic remedies.",
      hi: "सभी ग्रह राहु-केतु अक्ष के बीच — जीवन तीव्र लहरों में चलता है; विलंब के बाद अचानक सफलता। भक्ति और धैर्य श्रेष्ठ उपाय हैं।",
    },
  },
  "guru-chandal": {
    name: { en: "Guru Chandal Dosha", hi: "गुरु चांडाल दोष" },
    meaning: {
      en: "Jupiter with a node can distort judgement and ethics; keep counsel of genuine teachers.",
      hi: "गुरु-राहु/केतु की युति विवेक और नीति को भ्रमित कर सकती है; सच्चे गुरुजनों का मार्गदर्शन लें।",
    },
  },
  grahan: {
    name: { en: "Grahan Dosha", hi: "ग्रहण दोष" },
    meaning: {
      en: "A luminary with a node — emotional or ego eclipses at times; meditation and light discipline help greatly.",
      hi: "सूर्य/चंद्र पर राहु-केतु का प्रभाव — कभी-कभी मन या अहं पर ग्रहण; ध्यान और नियमित दिनचर्या से बड़ी राहत।",
    },
  },
  shakata: {
    name: { en: "Shakata Yoga", hi: "शकट योग" },
    meaning: {
      en: "Moon in 6/8/12 from Jupiter — fortunes fluctuate in cycles; savings discipline smooths the ride.",
      hi: "गुरु से 6/8/12 में चंद्र — भाग्य चक्रों में घटता-बढ़ता है; बचत का अनुशासन सहारा देता है।",
    },
  },
  "lagna-lord-strong": {
    name: { en: "Strong Lagna Lord", hi: "बली लग्नेश" },
    meaning: {
      en: "The ascendant lord is well placed — vitality, self-direction and the capacity to overcome obstacles.",
      hi: "लग्नेश की शुभ स्थिति — जीवनी शक्ति, आत्मनिर्णय और बाधाओं को पार करने की क्षमता।",
    },
  },
};
