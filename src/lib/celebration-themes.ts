/**
 * Celebration Management — festivals and animation themes (safe for client and server, no imports).
 * One common rendering system (components/celebrations/CelebrationEffects) reads these settings; no page per festival.
 */
export type ThemeKey =
    | 'DIYAS' | 'GOLDEN_SHIMMER' | 'HOLI_COLORS' | 'EID_MOON' | 'SNOWFALL' | 'NEW_YEAR' | 'TRICOLOR_RIBBONS'
    | 'TRICOLOR_WAVES' | 'NAVRATRI_LIGHTS' | 'MARIGOLD' | 'PEACOCK' | 'RAKHI_PETALS' | 'DUSSEHRA_LIGHTS' | 'ELEGANT' | 'CONFETTI';

export const THEMES: { key: ThemeKey; label: string; description: string }[] = [
    { key: 'DIYAS', label: 'Glowing Diyas', description: 'Glowing diyas at the screen edges and warm golden particles' },
    { key: 'GOLDEN_SHIMMER', label: 'Golden Shimmer', description: 'Golden shimmer and festive lights' },
    { key: 'HOLI_COLORS', label: 'Holi Colours', description: 'Floating colourful particles' },
    { key: 'EID_MOON', label: 'Crescent Moon & Stars', description: 'Crescent moon and twinkling stars' },
    { key: 'SNOWFALL', label: 'Snowfall', description: 'Gentle snowfall and festive lights' },
    { key: 'NEW_YEAR', label: 'Sparkles & Confetti', description: 'Sparkling lights and subtle confetti' },
    { key: 'TRICOLOR_RIBBONS', label: 'Tricolour Ribbons', description: 'Subtle tricolour ribbons' },
    { key: 'TRICOLOR_WAVES', label: 'Tricolour Waves', description: 'Tricolour waves and decorative particles' },
    { key: 'NAVRATRI_LIGHTS', label: 'Festive Lights', description: 'Decorative lights and festive particles' },
    { key: 'MARIGOLD', label: 'Marigold Petals', description: 'Marigold petals and golden lights' },
    { key: 'PEACOCK', label: 'Peacock Feathers', description: 'Peacock-feather-inspired decorative effects' },
    { key: 'RAKHI_PETALS', label: 'Rakhi & Petals', description: 'Decorative rakhi and flower petals' },
    { key: 'DUSSEHRA_LIGHTS', label: 'Golden Lights', description: 'Golden lights and festive particles' },
    { key: 'ELEGANT', label: 'Elegant Celebration', description: 'Generic elegant celebration effects' },
    { key: 'CONFETTI', label: 'Confetti', description: 'Colourful confetti (birthdays)' },
];
export const FESTIVAL_THEME_KEYS = THEMES.filter(t => t.key !== 'CONFETTI').map(t => t.key);

export const FESTIVALS: { key: string; name: string; theme: ThemeKey; greeting: string }[] = [
    { key: 'DIWALI', name: 'Diwali', theme: 'DIYAS', greeting: 'Happy Diwali! May this festival of lights bring joy and prosperity.' },
    { key: 'DHANTERAS', name: 'Dhanteras', theme: 'GOLDEN_SHIMMER', greeting: 'Happy Dhanteras! Wishing you health, wealth and happiness.' },
    { key: 'HOLI', name: 'Holi', theme: 'HOLI_COLORS', greeting: 'Happy Holi! May your life be filled with colours of joy.' },
    { key: 'EID', name: 'Eid', theme: 'EID_MOON', greeting: 'Eid Mubarak! Wishing you peace, joy and blessings.' },
    { key: 'CHRISTMAS', name: 'Christmas', theme: 'SNOWFALL', greeting: 'Merry Christmas! Wishing you joy and warmth this season.' },
    { key: 'NEW_YEAR', name: 'New Year', theme: 'NEW_YEAR', greeting: 'Happy New Year! Here is to a wonderful year ahead.' },
    { key: 'INDEPENDENCE_DAY', name: 'Independence Day', theme: 'TRICOLOR_RIBBONS', greeting: 'Happy Independence Day! Jai Hind.' },
    { key: 'REPUBLIC_DAY', name: 'Republic Day', theme: 'TRICOLOR_WAVES', greeting: 'Happy Republic Day! Jai Hind.' },
    { key: 'NAVRATRI', name: 'Navratri', theme: 'NAVRATRI_LIGHTS', greeting: 'Happy Navratri! May the nine nights bring you strength and joy.' },
    { key: 'GANESH_CHATURTHI', name: 'Ganesh Chaturthi', theme: 'MARIGOLD', greeting: 'Happy Ganesh Chaturthi! Ganpati Bappa Morya.' },
    { key: 'JANMASHTAMI', name: 'Janmashtami', theme: 'PEACOCK', greeting: 'Happy Janmashtami! May Lord Krishna bless you.' },
    { key: 'RAKSHA_BANDHAN', name: 'Raksha Bandhan', theme: 'RAKHI_PETALS', greeting: 'Happy Raksha Bandhan! Celebrating the bond of love.' },
    { key: 'DUSSEHRA', name: 'Dussehra', theme: 'DUSSEHRA_LIGHTS', greeting: 'Happy Dussehra! May good always triumph over evil.' },
    { key: 'GENERAL', name: 'General Celebration', theme: 'ELEGANT', greeting: 'Wishing everyone a wonderful celebration!' },
];
export const festivalOf = (key?: string) => FESTIVALS.find(f => f.key === key);

export type BannerAlign = 'left' | 'center' | 'right';
export type PhotoPosition = 'left' | 'right' | 'center' | 'none';

/** What the dashboard header shows (same object for the live dashboard and every preview) */
export type BannerData = {
    kind: 'birthday-self' | 'birthday-colleague' | 'festival' | 'vacation';
    imageUrl?: string;
    heading: string;
    subheading?: string;
    headingColor?: string;
    textColor?: string;
    bgColor?: string;
    overlayColor?: string;
    align?: BannerAlign;
    photoPosition?: PhotoPosition;
    person?: { name: string; designation?: string; college?: string; photoUrl?: string };
};
export type ColleagueBirthday = { id: string; name: string; designation?: string; college?: string; photoUrl?: string; banner: BannerData };
export type EffectData = { type: 'birthday' | 'festival'; theme: ThemeKey; key: string; opening: boolean; subtle: boolean };
export type TodayCelebration = { date: string; banner: BannerData | null; colleagues: ColleagueBirthday[]; effect: EffectData | null; birthdaySelf: boolean };

/** Built-in banners used when HR has not uploaded / selected one */
export const DEFAULTS = {
    birthdaySelf: { heading: 'Happy Birthday, {firstName}!', subheading: 'Wishing you a wonderful year ahead from everyone at Geeks of Gurukul.', headingColor: '#ffffff', textColor: '#d1fae5', bgColor: '#064e3b', overlayColor: 'rgba(0,0,0,0.25)', align: 'left' as BannerAlign, photoPosition: 'right' as PhotoPosition },
    birthdayColleague: { heading: 'Happy Birthday, {name}!', subheading: 'Wishing our colleague a wonderful year ahead.', headingColor: '#ffffff', textColor: '#e0f2fe', bgColor: '#0c4a6e', overlayColor: 'rgba(0,0,0,0.25)', align: 'left' as BannerAlign, photoPosition: 'right' as PhotoPosition },
    vacation: { subheading: 'Enjoy your holidays and have a wonderful celebration!', headingColor: '#ffffff', textColor: '#e4e4e7', bgColor: '#14532d', overlayColor: 'rgba(0,0,0,0.30)', align: 'left' as BannerAlign },
    festival: { textColor: '#ffffff', bgColor: '#7c2d12' },
};
export const vacationHeading = (holidayName: string) => `It's Your ${String(holidayName || 'Holiday').replace(/^holiday:\s*/i, '').replace(/\s+(vacation|holidays?)$/i, '').trim() || 'Holiday'} Vacation!`;
/** {name} / {firstName} / {designation} in a greeting */
export const fillGreeting = (t: string, p?: { name?: string; designation?: string }) =>
    String(t || '').replace(/\{name\}/g, p?.name || '').replace(/\{firstName\}/g, String(p?.name || '').split(/\s+/)[0] || '').replace(/\{designation\}/g, p?.designation || '');
export const isHexColor = (v: any) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
export const isCssColor = (v: any) => typeof v === 'string' && (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v) || /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+))?\s*\)$/i.test(v));

const fromTemplate = (t: any, fallback: any, kind: BannerData['kind'], person?: any): BannerData => ({
    kind,
    imageUrl: t?.imageUrl || undefined,
    heading: fillGreeting(t?.greeting || fallback.heading, person),
    subheading: fillGreeting(t?.subtext ?? fallback.subheading, person),
    headingColor: t?.headingColor || fallback.headingColor,
    textColor: t?.textColor || fallback.textColor,
    bgColor: t?.bgColor || fallback.bgColor,
    overlayColor: t?.overlayColor || fallback.overlayColor,
    align: (t?.align || fallback.align) as BannerAlign,
    photoPosition: (t?.photoPosition || fallback.photoPosition) as PhotoPosition,
    ...(person ? { person } : {}),
});
/** Banner builders — used by the server (live dashboard) and by every preview */
export function birthdayBanner(kind: 'birthday-self' | 'birthday-colleague', t: any, person: any) {
    return fromTemplate(t, kind === 'birthday-self' ? DEFAULTS.birthdaySelf : DEFAULTS.birthdayColleague, kind, person);
}
export function festivalBanner(f: any, t: any): BannerData {
    const def = festivalOf(f.festivalKey);
    return {
        kind: 'festival', imageUrl: t?.imageUrl || undefined,
        heading: f.greeting || def?.greeting || `Happy ${f.name}!`,
        headingColor: f.textColor || t?.headingColor || DEFAULTS.festival.textColor, textColor: f.textColor || t?.textColor || DEFAULTS.festival.textColor,
        bgColor: f.bgColor || t?.bgColor || DEFAULTS.festival.bgColor, overlayColor: t?.overlayColor || 'rgba(0,0,0,0.20)', align: (t?.align || 'center') as BannerAlign,
    };
}
export function vacationBanner(vb: any, holidayName: string): BannerData {
    return {
        kind: 'vacation', imageUrl: typeof vb?.activeImage === 'string' && /^https:\/\//i.test(vb.activeImage) ? vb.activeImage : undefined,
        heading: vb?.heading || vacationHeading(holidayName), subheading: vb?.subheading ?? DEFAULTS.vacation.subheading,
        headingColor: vb?.headingColor || DEFAULTS.vacation.headingColor, textColor: vb?.textColor || DEFAULTS.vacation.textColor,
        bgColor: vb?.bgColor || DEFAULTS.vacation.bgColor, overlayColor: vb?.overlayColor || DEFAULTS.vacation.overlayColor,
        align: (vb?.align || DEFAULTS.vacation.align) as BannerAlign,
    };
}
