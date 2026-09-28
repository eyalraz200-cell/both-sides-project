// English strings for en/index.html (<html class="lang-en">). Loaded FIRST, by
// both pages, so every other script can call tr() at parse time.
//
// tr() is display-only: the Hebrew strings stay the keys everywhere (event
// `category`, P9_CATEGORIES, GROUPS labels), so nothing that JOINS on them
// changes. On the Hebrew page tr() returns its argument untouched.
function isEnglish() {
  return document.documentElement.classList.contains("lang-en");
}

const I18N_EN = {
  // Camps
  "קואליציית הימין": "The Right-Wing Coalition",
  "גוש השינוי": "The Change Bloc",
  // Groups
  "פעילים ערבים ישראלים": "Israeli Arab activists",
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
  "הצגת גודל האירועים": "Show event scale",
  // @fold14
  "גררו סוגי פעולות הנחשבות קיצוניות בעיניכם": "Drag the types of action you consider extreme",
  "סמנו פעולות הנחשבות לקיצוניות בעיניכם": "Mark the actions you consider extreme",
  // Share row
  "העתקת קישור": "Copy link",
  "הקישור הועתק": "Link copied",
  "העתיקו את הקישור:": "Copy the link:",
  // Timeline axis events — labels
  "הכרזת הרפורמה": "Judicial Overhaul",
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
  "לקיחה או החזקה של אדם בלתי מעורב בניגוד לרצונו.": "Taking or holding an uninvolved person against their will.",
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

function tr(s) {
  return (isEnglish() && I18N_EN[s]) || s;
}
