// Dasha lord themes + transit tone fragments (bilingual).

import type { PlanetId } from "@/lib/astro/types";
import type { Bi } from "./core";

export const DASHA_THEMES: Record<PlanetId, Bi> = {
  Sun: {
    en: "a period of visibility, authority and self-definition — career and dealings with government or seniors come to the fore; watch health of the father and your own vitality",
    hi: "प्रतिष्ठा, अधिकार और आत्म-निर्माण का समय — करियर और सरकार/वरिष्ठों से जुड़े कार्य प्रमुख रहते हैं; पिता के स्वास्थ्य और अपनी ऊर्जा का ध्यान रखें",
  },
  Moon: {
    en: "an emotionally rich period — home, mother, public connection and travel feature strongly; the mind is impressionable, so nurture routines",
    hi: "भावनात्मक रूप से समृद्ध समय — घर, माता, जन-संपर्क और यात्राएँ प्रमुख; मन संवेदनशील रहता है, दिनचर्या का पोषण करें",
  },
  Mars: {
    en: "a period of action, competition and courage — property matters, sports and technical pursuits advance; guard against haste and disputes",
    hi: "क्रिया, प्रतिस्पर्धा और साहस का समय — संपत्ति, खेल और तकनीकी कार्य आगे बढ़ते हैं; जल्दबाजी और विवाद से बचें",
  },
  Mercury: {
    en: "a period of learning, commerce and connection — studies, writing, business and networks thrive; health of nerves and skin needs balance",
    hi: "विद्या, व्यापार और संपर्क का समय — अध्ययन, लेखन, व्यवसाय और नेटवर्क फलते-फूलते हैं; तंत्रिका और त्वचा संतुलन माँगती है",
  },
  Jupiter: {
    en: "an expansive, protective period — knowledge, children, finances and dharma grow; opportunities arrive through teachers and mentors",
    hi: "विस्तार और रक्षा का समय — ज्ञान, संतान, धन और धर्म में वृद्धि; गुरुजनों और मार्गदर्शकों से अवसर मिलते हैं",
  },
  Venus: {
    en: "a period of relationships, comfort and creativity — marriage, vehicles, luxuries and artistic ventures are highlighted; indulgence needs moderation",
    hi: "संबंध, सुख और सृजन का समय — विवाह, वाहन, वैभव और कला के कार्य प्रमुख; भोग में संयम आवश्यक",
  },
  Saturn: {
    en: "a period of discipline and karma — slow, structural progress through persistent work; responsibilities grow, shortcuts fail, but what is built endures",
    hi: "अनुशासन और कर्म का समय — निरंतर परिश्रम से धीमी किंतु ठोस प्रगति; उत्तरदायित्व बढ़ते हैं, शॉर्टकट विफल होते हैं, पर जो बनता है वह टिकता है",
  },
  Rahu: {
    en: "a period of ambition and unconventional growth — foreign connections, technology and bold ventures rise fast; keep ethics and health anchored",
    hi: "महत्वाकांक्षा और अपरंपरागत उन्नति का समय — विदेश, तकनीक और साहसिक उद्यम तेजी से बढ़ते हैं; नैतिकता और स्वास्थ्य को स्थिर रखें",
  },
  Ketu: {
    en: "a period of detachment and inner work — spiritual growth, research and letting go; material matters may feel uncertain, but insight deepens",
    hi: "वैराग्य और आंतरिक साधना का समय — आध्यात्मिक उन्नति, शोध और मोह-त्याग; भौतिक विषय अनिश्चित लग सकते हैं, पर अंतर्दृष्टि गहराती है",
  },
};

/** Short gochar tone lines per planet, favourable vs challenging */
export const TRANSIT_TONE: Record<PlanetId, { good: Bi; bad: Bi }> = {
  Sun: {
    good: { en: "recognition and clarity increase", hi: "मान-सम्मान और स्पष्टता बढ़ती है" },
    bad: { en: "ego friction with authority is possible", hi: "अधिकारियों से मतभेद संभव" },
  },
  Moon: {
    good: { en: "mood and public dealings flow well", hi: "मन प्रसन्न और जन-संपर्क अनुकूल" },
    bad: { en: "the mind is restless — decide slowly", hi: "मन चंचल — निर्णय धीरे लें" },
  },
  Mars: {
    good: { en: "energy and initiative pay off", hi: "ऊर्जा और पहल का लाभ मिलता है" },
    bad: { en: "avoid conflicts, accidents and haste", hi: "विवाद, दुर्घटना और जल्दबाजी से बचें" },
  },
  Mercury: {
    good: { en: "communication and trade prosper", hi: "संवाद और व्यापार में लाभ" },
    bad: { en: "double-check documents and words", hi: "दस्तावेज़ और वाणी में सावधानी रखें" },
  },
  Jupiter: {
    good: { en: "growth, guidance and good fortune expand", hi: "उन्नति, मार्गदर्शन और सौभाग्य बढ़ता है" },
    bad: { en: "over-optimism may cause overreach", hi: "अति-आशावाद से अति-विस्तार संभव" },
  },
  Venus: {
    good: { en: "comforts, love and finances improve", hi: "सुख, प्रेम और धन में वृद्धि" },
    bad: { en: "indulgence and expenses need watching", hi: "भोग और खर्च पर नज़र रखें" },
  },
  Saturn: {
    good: { en: "steady effort brings durable results", hi: "निरंतर परिश्रम स्थायी फल देता है" },
    bad: { en: "delays test patience — persist calmly", hi: "विलंब धैर्य की परीक्षा लेता है — शांत रहकर लगे रहें" },
  },
  Rahu: {
    good: { en: "bold, modern moves succeed", hi: "साहसिक, आधुनिक कदम सफल होते हैं" },
    bad: { en: "avoid shortcuts, confusion and speculation", hi: "शॉर्टकट, भ्रम और सट्टे से बचें" },
  },
  Ketu: {
    good: { en: "research and spiritual work deepen", hi: "शोध और साधना गहरी होती है" },
    bad: { en: "absent-mindedness — stay grounded", hi: "अन्यमनस्कता — सजग रहें" },
  },
};
