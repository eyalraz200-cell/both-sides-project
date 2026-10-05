// English strings for en/index.html (<html class="lang-en">). Loaded FIRST, by
// both pages, so every other script can call tr() at parse time.
//
// tr() is display-only: the Hebrew strings stay the keys everywhere (event
// `category`, P9_CATEGORIES, GROUPS labels), so nothing that JOINS on them
// changes. On the Hebrew page tr() returns its argument untouched.
function isEnglish() {
  return document.documentElement.classList.contains("lang-en");
}
// Arabic page (ar/index.html, <html class="lang-ar">): same RTL layout as the
// Hebrew page, its own strings in I18N_AR — filled by translate_ui_ar.py.
function isArabic() {
  return document.documentElement.classList.contains("lang-ar");
}

const I18N_EN = {
  // Camps
  // The \n is a line break on the PHONE only (.lang-en .camp-header is
  // `pre` under 600px); everywhere else it collapses to a space.
  "קואליציית הימין": "The Right-Wing\nCoalition",
  "גוש השינוי": "The Change\nBloc",
  // Groups
  "גורמים ערבים ישראלים": "Arab Israeli actors",
  "תנועות התנחלות באיו״ש": "West Bank settler movements",
  "קבוצות ימין לאומיות": "Nationalist right-wing groups",
  "מתנגדי הרפורמה המשפטית ומדיניות הממשלה": "Coalition policy and judicial overhaul opponents",
  "מתנגדי הרפורמה ומדיניות הממשלה": "Coalition policy and judicial overhaul opponents",
  "תומכי עסקת חטופים ומתנגדי המלחמה": "Hostage deal supporters and Gaza war opponents",
  "מפגינים חרדים": "Haredi Jewish protesters",
  // Legend / controls
  "מקרא": "Legend",
  "סגירת המקרא": "Close the legend",
  "איסוף הנתונים": "Data collection",
  "לשיטת העבודה המלאה": "Full methodology",
  "הצגת גודל האירועים": "Show event scale",
  // @fold12
  "גררו סוגי פעולות הנחשבות קיצוניות בעיניכם": "Drag the types of action you consider extreme",
  "סמנו פעולות הנחשבות לקיצוניות בעיניכם": "Mark the actions you consider extreme",
  // Share row
  "העתקת קישור": "Copy link",
  "הקישור הועתק": "Link copied",
  "העתיקו את הקישור:": "Copy the link:",
  // Timeline axis events — labels
  "הכרזת הרפורמה": "Judicial Overhaul",
  "הכרזת הרפורמה המשפטית": "Judicial Overhaul",   // the phone's title for the same event (labelMobile, page7.js)
  "הפיגוע בעלי": "Eli Terror Attack",
  "ביטול עילת הסבירות": "Judicial Review Law",
  "מתקפת 7 באוקטובר": "October 7 Attack",
  "מות ששת החטופים": "Six Hostages Killed",
  "חידוש הלחימה בעזה": "Gaza War Resumes",
  "מבצע ״עם כלביא״": "Rising Lion",
  "שחרור החטופים מעזה": "Hostages Released",
  "התפזרות הכנסת ה-25": "Knesset Dissolved",
  // Timeline axis events — hover descriptions
  "הצגת תוכניתו של שר המשפטים יריב לוין לשינויים במערכת המשפט.": "Justice Minister Yariv Levin presents his plan to overhaul Israel’s judicial system.",
  "פיגוע ירי סמוך ליישוב עלי, שבו נהרגו ארבעה ישראלים.": "A shooting attack near the settlement of Eli kills four Israelis.",
  "אישור התיקון שמנע ביקורת שיפוטית על סבירות החלטות הממשלה והשרים.": "An amendment is passed barring courts from reviewing the reasonableness of government and ministerial decisions.",
  "מתקפה בהובלת חמאס על יישובים ובסיסים בדרום ישראל, שכללה הרג וחטיפת אזרחים ואנשי ביטחון.": "A Hamas-led attack on communities and military bases in southern Israel includes killings and the abduction of civilians and security personnel.",
  "הודעת צה״ל על חילוץ גופותיהם של שישה חטופים שנרצחו בשבי ברפיח.": "The IDF announces the recovery of the bodies of six hostages killed in captivity in Rafah.",
  "חידוש התקיפות הישראליות הנרחבות בעזה לאחר כחודשיים של הפסקת אש.": "Israel resumes large-scale strikes in Gaza after nearly two months of ceasefire.",
  "פתיחת המבצע הישראלי נגד מטרות גרעין וצבא באיראן, ובעקבותיו ירי איראני לעבר ישראל.": "Israel launches an operation against nuclear and military targets in Iran, followed by Iranian fire toward Israel.",
  "שחרור עשרים החטופים החיים שנותרו בעזה במסגרת הסכם הפסקת אש.": "The 20 remaining living hostages in Gaza are released as part of a ceasefire agreement.",
  "אישור התפזרות הכנסת לקראת הבחירות באוקטובר.": "The 25th Knesset dissolves ahead of the October election.",
  // Action-type pill tooltips (P9_CATEGORY_DESC, page9.js)
  "הפגנה, עצרת, צעדה או נוכחות מחאתית ללא אלימות מצד המפגינים.": "A protest, rally, march, or other protest presence without violence by participants.",
  "התקפה המונית על קהילה, שכונה או אזור מגורים, הכוללת פגיעה באנשים, ברכוש או במרחב האזרחי.": "A mass attack on a community, neighborhood, or residential area involving harm to people, property, or civilian space.",
  "לקיחה או החזקה של אדם בניגוד לרצונו.": "Taking or holding a person against their will.",
  "תקיפת אדם באמצעות אבנים, מקלות, סכינים או אמצעים חדים וקהים אחרים.": "Attacking a person with stones, sticks, knives, or other sharp or blunt objects.",
  "תקיפת אדם באמצעות ירי בנשק חם, חומרי נפץ או הצתה.": "Attacking a person using firearms, explosives, or arson.",
  "תקיפת אדם באמצעות מכות, דחיפות, בעיטות או מגע גופני אלים אחר, ללא שימוש בנשק.": "Attacking a person through hitting, pushing, kicking, or other violent physical contact, without a weapon.",
  "עימותים, התפרעויות, או פעולות שמפרות את הסדר הציבורי.": "Clashes, riots, or other actions that disrupt public order.",
  "ביסוס שליטה בשטח שאינו שייך לקבוצה הפועלת, באמצעות גידור, עיבוד, בנייה, הצבת מבנים או הקמת מאחז.": "Establishing control over land through fencing, cultivation, construction, placing structures, or establishing an outpost.",
  "גרימת נזק למבנים, כלי רכב, תשתיות, שטחים חקלאיים או רכוש אחר.": "Damaging buildings, vehicles, infrastructure, farmland, or other property.",
  "חסימה של כבישים, צמתים או דרכי גישה כחלק ממחאה או עימות.": "Blocking roads, intersections, or access routes as part of a protest or confrontation.",
  // Small UI words
  "אירועים": "events",
  "עוד": "More",
  "פחות": "Less",
  "לחצו והחזיקו על נקודה להצגת פרטי האירוע": "Press and hold a dot to see the event details",
  // Action types
  "הפגנה לא אלימה": "Non-violent protest",
  "חסימת כביש": "Road blockade",
  "הפרות סדר": "Public disorder",
  "הטרדה ואיומים": "Harassment and threats",
  "החזקה בכפייה": "Forced confinement",
  "תקיפה פיזית": "Physical assault",
  "תקיפה בנשק קר": "Melee weapon attack",
  "תקיפה בנשק חם": "Firearm attack",
  "פגיעה ברכוש": "Property damage",
  "ניכוס שטח": "Land seizure",
  "פוגרום": "Pogrom",
};

// Arabic strings, keyed by the Hebrew like I18N_EN. GENERATED between the
// markers by translate_ui_ar.py (Hebrew + English pair → Arabic) — edit the
// Arabic in place if you must, but re-running the script overwrites the block.
const I18N_AR = {
  // I18N_AR_START
  "קואליציית הימין": "ائتلاف اليمين",
  "גוש השינוי": "كتلة التغيير",
  "גורמים ערבים ישראלים": "عناصر من مواطني إسرائيل العرب",
  "תנועות התנחלות באיו״ש": "حركات المستوطنين في الضفة الغربية",
  "קבוצות ימין לאומיות": "مجموعات يمينية قومية",
  "מתנגדי הרפורמה המשפטית ומדיניות הממשלה": "معارضو التعديلات القضائية وسياسة الحكومة",
  "מתנגדי הרפורמה ומדיניות הממשלה": "معارضو التعديلات القضائية وسياسة الحكومة",
  "תומכי עסקת חטופים ומתנגדי המלחמה": "مؤيدو صفقة الرهائن ومعارضو الحرب في غزة",
  "מפגינים חרדים": "متظاهرون من اليهود الحريديم",
  "מקרא": "مفتاح الرموز",
  "סגירת המקרא": "إغلاق مفتاح الرموز",
  "איסוף הנתונים": "جمع البيانات",
  "לשיטת העבודה המלאה": "منهجية العمل الكاملة",
  "הצגת גודל האירועים": "عرض حجم الأحداث",
  "גררו סוגי פעולות הנחשבות קיצוניות בעיניכם": "اسحبوا أنواع التحركات التي ترونها متطرفة",
  "סמנו פעולות הנחשבות לקיצוניות בעיניכם": "حددوا التحركات التي ترونها متطرفة",
  "העתקת קישור": "نسخ الرابط",
  "הקישור הועתק": "تم نسخ الرابط",
  "העתיקו את הקישור:": "انسخوا الرابط:",
  "הכרזת הרפורמה": "التعديلات القضائية",
  "הכרזת הרפורמה המשפטית": "الإعلان عن خطة التعديلات القضائية",
  "הפיגוע בעלי": "الهجوم في عيلي",
  "ביטול עילת הסבירות": "إلغاء معيار المعقولية",
  "מתקפת 7 באוקטובר": "هجوم 7 أكتوبر",
  "מות ששת החטופים": "مقتل الرهائن الستة",
  "חידוש הלחימה בעזה": "استئناف القتال في غزة",
  "מבצע ״עם כלביא״": "«الأسد الصاعد»",
  "שחרור החטופים מעזה": "إطلاق سراح الرهائن",
  "התפזרות הכנסת ה-25": "حلّ الكنيست الـ25",
  "הצגת תוכניתו של שר המשפטים יריב לוין לשינויים במערכת המשפט.": "عرض وزير العدل ياريف ليفين خطته لإجراء تغييرات في المنظومة القضائية.",
  "פיגוע ירי סמוך ליישוב עלי, שבו נהרגו ארבעה ישראלים.": "هجوم بإطلاق النار قرب مستوطنة عيلي، قُتل فيه أربعة إسرائيليين.",
  "אישור התיקון שמנע ביקורת שיפוטית על סבירות החלטות הממשלה והשרים.": "إقرار التعديل الذي منع الرقابة القضائية على مدى معقولية قرارات الحكومة والوزراء.",
  "מתקפה בהובלת חמאס על יישובים ובסיסים בדרום ישראל, שכללה הרג וחטיפת אזרחים ואנשי ביטחון.": "هجوم قادته حماس على بلدات وقواعد عسكرية في جنوب إسرائيل، شمل قتل وخطف مدنيين وأفراد أمن.",
  "הודעת צה״ל על חילוץ גופותיהם של שישה חטופים שנרצחו בשבי ברפיח.": "إعلان الجيش الإسرائيلي عن انتشال جثث ستة رهائن قُتلوا في الأسر في رفح.",
  "חידוש התקיפות הישראליות הנרחבות בעזה לאחר כחודשיים של הפסקת אש.": "استئناف الضربات الإسرائيلية الواسعة في غزة بعد نحو شهرين من وقف إطلاق النار.",
  "פתיחת המבצע הישראלי נגד מטרות גרעין וצבא באיראן, ובעקבותיו ירי איראני לעבר ישראל.": "بدء العملية الإسرائيلية ضد أهداف نووية وعسكرية في إيران، أعقبه إطلاق نيران إيرانية باتجاه إسرائيل.",
  "שחרור עשרים החטופים החיים שנותרו בעזה במסגרת הסכם הפסקת אש.": "إطلاق سراح الرهائن العشرين الأحياء المتبقين في غزة ضمن اتفاق لوقف إطلاق النار.",
  "אישור התפזרות הכנסת לקראת הבחירות באוקטובר.": "إقرار حلّ الكنيست تمهيدًا للانتخابات في أكتوبر.",
  "הפגנה, עצרת, צעדה או נוכחות מחאתית ללא אלימות מצד המפגינים.": "مظاهرة أو تجمع أو مسيرة أو حضور احتجاجي من دون عنف من جانب المتظاهرين.",
  "התקפה המונית על קהילה, שכונה או אזור מגורים, הכוללת פגיעה באנשים, ברכוש או במרחב האזרחי.": "هجوم جماعي على تجمع سكاني أو حي أو منطقة سكنية، يشمل إلحاق أذى بأشخاص أو بممتلكات أو بالحيز المدني.",
  "לקיחה או החזקה של אדם בניגוד לרצונו.": "أخذ شخص أو احتجازه خلافًا لإرادته.",
  "תקיפת אדם באמצעות אבנים, מקלות, סכינים או אמצעים חדים וקהים אחרים.": "الاعتداء على شخص بالحجارة أو العصي أو السكاكين أو أدوات حادة أو راضّة أخرى.",
  "תקיפת אדם באמצעות ירי בנשק חם, חומרי נפץ או הצתה.": "الاعتداء على شخص بإطلاق النار من سلاح ناري أو بمواد متفجرة أو بإضرام النار.",
  "תקיפת אדם באמצעות מכות, דחיפות, בעיטות או מגע גופני אלים אחר, ללא שימוש בנשק.": "الاعتداء على شخص بالضرب أو الدفع أو الركل أو أي تلامس جسدي عنيف آخر، من دون استخدام سلاح.",
  "עימותים, התפרעויות, או פעולות שמפרות את הסדר הציבורי.": "اشتباكات أو اضطرابات أو أعمال تخلّ بالنظام العام.",
  "ביסוס שליטה בשטח שאינו שייך לקבוצה הפועלת, באמצעות גידור, עיבוד, בנייה, הצבת מבנים או הקמת מאחז.": "بسط السيطرة على أرض لا تعود إلى المجموعة المنفذة، عبر تسييجها أو زراعتها أو البناء عليها أو وضع منشآت فيها أو إقامة بؤرة استيطانية.",
  "גרימת נזק למבנים, כלי רכב, תשתיות, שטחים חקלאיים או רכוש אחר.": "إلحاق أضرار بمبانٍ أو مركبات أو بنى تحتية أو أراضٍ زراعية أو ممتلكات أخرى.",
  "חסימה של כבישים, צמתים או דרכי גישה כחלק ממחאה או עימות.": "إغلاق طرق أو تقاطعات أو مسالك وصول في إطار احتجاج أو مواجهة.",
  "אירועים": "أحداث",
  "עוד": "أكثر",
  "פחות": "أقل",
  "לחצו והחזיקו על נקודה להצגת פרטי האירוע": "اضغطوا مطوّلًا على نقطة لعرض تفاصيل الحدث",
  "הפגנה לא אלימה": "مظاهرة سلمية",
  "חסימת כביש": "إغلاق طريق",
  "הפרות סדר": "إخلال بالنظام العام",
  "הטרדה ואיומים": "مضايقات وتهديدات",
  "החזקה בכפייה": "احتجاز قسري",
  "תקיפה פיזית": "اعتداء جسدي",
  "תקיפה בנשק קר": "اعتداء بسلاح أبيض",
  "תקיפה בנשק חם": "اعتداء بسلاح ناري",
  "פגיעה ברכוש": "إضرار بالممتلكات",
  "ניכוס שטח": "استيلاء على أرض",
  "פוגרום": "أعمال شغب",
  // @fold6 ACLED note (FOLD6_NOTE_TEXT, js/groups.js)
  "הפרויקט כולל פעולות פוליטיות שביצעו אזרחי ישראל במרחב הציבורי, בישראל ובשטחים, מתחילת 2023. מרבית תיאורי האירועים ומועדיהם לקוחים ממאגר ACLED, גוף מחקר בינלאומי המתעד וממפה מחאה ואלימות פוליטית על בסיס דיווחי תקשורת ומקורות מקומיים. מאגר ״המבצר״ שימש מקור משלים. התיאורים נערכו וקוצרו תוך שמירה על העובדות וההקשר, ותיאורי ACLED תורגמו לעברית. שיוך האירועים לקבוצות ולמחנות, סיווג הפעולות והערכת מספר המשתתפים נעשו במסגרת הפרויקט על סמך התיאורים ובעזרת מודלי שפה של OpenAI. ניתוח זה הוא באחריות הפרויקט ואינו מטעם מקורות הנתונים.": "يشمل المشروع أفعالًا سياسية نفّذها مواطنون إسرائيليون في الحيّز العام، في إسرائيل والأراضي المحتلة، منذ بداية عام 2023. معظم أوصاف الأحداث وتواريخها مأخوذة من قاعدة بيانات ACLED، وهي مؤسسة بحثية دولية توثّق الاحتجاج والعنف السياسي وترسم خرائط لهذه الأحداث بالاستناد إلى تقارير وسائل الإعلام والمصادر المحلية. واستُخدمت قاعدة بيانات «هاميفتسار» مصدرًا مكمّلًا. وقد حُرّرت الأوصاف واختُصرت مع الحفاظ على الوقائع والسياق، وتُرجمت أوصاف ACLED إلى العبرية؛ وتُرجمت الأوصاف العربية من النسخ العبرية المحرّرة. وجرى إسناد الأحداث إلى المجموعات والمعسكرات السياسية، وتصنيف الأفعال، وتقدير أعداد المشاركين ضمن المشروع، استنادًا إلى الأوصاف وباستخدام نماذج لغوية من OpenAI. ويتحمّل المشروع مسؤولية هذا التحليل، الذي لم يُنجَز نيابةً عن الجهات الموفّرة للبيانات.",
  // I18N_AR_END
};

// The face canvas text is drawn in. CSS falls back per element (.lang-ar rules
// in style.css), but a ctx.font string names its own face — Assistant has no
// Arabic glyphs, so the Arabic page draws its canvas labels in IBM Plex Sans
// Arabic. Every ctx.font that used to say 'Assistant' goes through this.
const CANVAS_FACE = isArabic() ? "'IBM Plex Sans Arabic', 'Assistant', sans-serif" : "'Assistant', sans-serif";

function tr(s) {
  const map = isEnglish() ? I18N_EN : isArabic() ? I18N_AR : null;
  return (map && map[s]) || s;
}
