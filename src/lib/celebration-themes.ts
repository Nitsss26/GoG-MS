/**
 * Celebration Management — festivals and animation themes (safe for client and server, no imports).
 * One common rendering system (components/celebrations/CelebrationEffects) reads these settings; no page per festival.
 */
export type ThemeKey =
    | 'DIYAS' | 'GOLDEN_SHIMMER' | 'HOLI_COLORS' | 'EID_MOON' | 'SNOWFALL' | 'NEW_YEAR' | 'TRICOLOR_RIBBONS'
    | 'TRICOLOR_WAVES' | 'NAVRATRI_LIGHTS' | 'MARIGOLD' | 'PEACOCK' | 'RAKHI_PETALS' | 'DUSSEHRA_LIGHTS' | 'ELEGANT' | 'CONFETTI'
    // added themes (the 15 above are unchanged)
    | 'FIREWORKS' | 'FLOATING_LANTERNS' | 'FLOWER_RAIN' | 'ROSE_PETALS' | 'LOTUS_GLOW' | 'SPARKLE_RAIN' | 'FIREFLIES'
    | 'BOKEH_LIGHTS' | 'LIGHT_STRINGS' | 'RANGOLI_REVEAL' | 'FLOATING_BALLOONS' | 'PARTY_POPPERS' | 'GIFT_BOXES'
    | 'BIRTHDAY_CANDLES' | 'CAKE_ANIMATION' | 'KITE_FESTIVAL' | 'PONGAL_POT' | 'ONAM_FLOWERS' | 'GARBA_LIGHTS'
    | 'CHRISTMAS_STARS' | 'SNOW_GLOBE' | 'MOON_STARS' | 'EID_LANTERNS' | 'GRADIENT_WAVES' | 'AURORA';

export type ThemeCategory = 'Traditional Indian Festivals' | 'Birthday & Party' | 'Lights & Sparkles' | 'Seasonal & Cultural' | 'Modern & Minimal';
export const THEME_CATEGORIES: ThemeCategory[] = ['Traditional Indian Festivals', 'Birthday & Party', 'Lights & Sparkles', 'Seasonal & Cultural', 'Modern & Minimal'];

/** Theme registry — one entry per animation (the renderer is components/celebrations/CelebrationEffects) */
export const THEMES: { key: ThemeKey; label: string; description: string; category: ThemeCategory }[] = [
    { key: 'DIYAS', label: 'Glowing Diyas', description: 'Glowing diyas at the screen edges and warm golden particles', category: 'Traditional Indian Festivals' },
    { key: 'GOLDEN_SHIMMER', label: 'Golden Shimmer', description: 'Golden shimmer and festive lights', category: 'Lights & Sparkles' },
    { key: 'HOLI_COLORS', label: 'Holi Colours', description: 'Floating colourful particles', category: 'Traditional Indian Festivals' },
    { key: 'EID_MOON', label: 'Crescent Moon & Stars', description: 'Crescent moon and twinkling stars', category: 'Seasonal & Cultural' },
    { key: 'SNOWFALL', label: 'Snowfall', description: 'Gentle snowfall and festive lights', category: 'Seasonal & Cultural' },
    { key: 'NEW_YEAR', label: 'Sparkles & Confetti', description: 'Sparkling lights and subtle confetti', category: 'Lights & Sparkles' },
    { key: 'TRICOLOR_RIBBONS', label: 'Tricolour Ribbons', description: 'Subtle tricolour ribbons', category: 'Seasonal & Cultural' },
    { key: 'TRICOLOR_WAVES', label: 'Tricolour Waves', description: 'Tricolour waves and decorative particles', category: 'Seasonal & Cultural' },
    { key: 'NAVRATRI_LIGHTS', label: 'Festive Lights', description: 'Decorative lights and festive particles', category: 'Traditional Indian Festivals' },
    { key: 'MARIGOLD', label: 'Marigold Petals', description: 'Marigold petals and golden lights', category: 'Traditional Indian Festivals' },
    { key: 'PEACOCK', label: 'Peacock Feathers', description: 'Peacock-feather-inspired decorative effects', category: 'Traditional Indian Festivals' },
    { key: 'RAKHI_PETALS', label: 'Rakhi & Petals', description: 'Decorative rakhi and flower petals', category: 'Traditional Indian Festivals' },
    { key: 'DUSSEHRA_LIGHTS', label: 'Golden Lights', description: 'Golden lights and festive particles', category: 'Traditional Indian Festivals' },
    { key: 'ELEGANT', label: 'Elegant Celebration', description: 'Generic elegant celebration effects', category: 'Modern & Minimal' },
    { key: 'CONFETTI', label: 'Confetti', description: 'Colourful confetti (birthdays)', category: 'Birthday & Party' },
    { key: 'FIREWORKS', label: 'Fireworks', description: 'Colourful fireworks bursting into sparkling particles', category: 'Lights & Sparkles' },
    { key: 'FLOATING_LANTERNS', label: 'Floating Lanterns', description: 'Glowing sky lanterns floating upward', category: 'Traditional Indian Festivals' },
    { key: 'FLOWER_RAIN', label: 'Flower Rain', description: 'Colourful flowers gently falling', category: 'Traditional Indian Festivals' },
    { key: 'ROSE_PETALS', label: 'Rose Petals', description: 'Soft rose petals drifting across the screen', category: 'Birthday & Party' },
    { key: 'LOTUS_GLOW', label: 'Lotus Glow', description: 'Glowing lotus flowers with soft rising light', category: 'Traditional Indian Festivals' },
    { key: 'SPARKLE_RAIN', label: 'Sparkle Rain', description: 'Golden and silver sparkles falling', category: 'Lights & Sparkles' },
    { key: 'FIREFLIES', label: 'Fireflies', description: 'Small glowing fireflies wandering and blinking', category: 'Lights & Sparkles' },
    { key: 'BOKEH_LIGHTS', label: 'Bokeh Lights', description: 'Soft out-of-focus lights floating in the background', category: 'Lights & Sparkles' },
    { key: 'LIGHT_STRINGS', label: 'Light Strings', description: 'Hanging fairy-light strings that twinkle', category: 'Lights & Sparkles' },
    { key: 'RANGOLI_REVEAL', label: 'Rangoli Reveal', description: 'Colourful rangoli drawing itself in the corners', category: 'Traditional Indian Festivals' },
    { key: 'FLOATING_BALLOONS', label: 'Floating Balloons', description: 'Colourful balloons floating upward', category: 'Birthday & Party' },
    { key: 'PARTY_POPPERS', label: 'Party Poppers', description: 'Party poppers bursting confetti and streamers', category: 'Birthday & Party' },
    { key: 'GIFT_BOXES', label: 'Gift Boxes', description: 'Wrapped gift boxes gently falling and turning', category: 'Birthday & Party' },
    { key: 'BIRTHDAY_CANDLES', label: 'Birthday Candles', description: 'Candles with flickering flames and rising sparks', category: 'Birthday & Party' },
    { key: 'CAKE_ANIMATION', label: 'Cake Animation', description: 'A birthday cake with flickering candles and sprinkles', category: 'Birthday & Party' },
    { key: 'KITE_FESTIVAL', label: 'Kite Festival', description: 'Colourful kites swaying in the sky', category: 'Traditional Indian Festivals' },
    { key: 'PONGAL_POT', label: 'Pongal Pot', description: 'Decorated Pongal pot with overflowing festive bubbles', category: 'Traditional Indian Festivals' },
    { key: 'ONAM_FLOWERS', label: 'Onam Flowers', description: 'Pookalam flower carpet and floating flowers', category: 'Traditional Indian Festivals' },
    { key: 'GARBA_LIGHTS', label: 'Garba Lights', description: 'Rotating rings of festive lights', category: 'Traditional Indian Festivals' },
    { key: 'CHRISTMAS_STARS', label: 'Christmas Stars', description: 'Twinkling Christmas stars and a glowing top star', category: 'Seasonal & Cultural' },
    { key: 'SNOW_GLOBE', label: 'Snow Globe', description: 'Snow swirling gently like inside a snow globe', category: 'Seasonal & Cultural' },
    { key: 'MOON_STARS', label: 'Moon & Stars', description: 'Crescent moon, twinkling stars and shooting stars', category: 'Seasonal & Cultural' },
    { key: 'EID_LANTERNS', label: 'Eid Lanterns', description: 'Hanging lanterns swaying with a warm glow', category: 'Seasonal & Cultural' },
    { key: 'GRADIENT_WAVES', label: 'Gradient Waves', description: 'Smooth flowing gradient waves', category: 'Modern & Minimal' },
    { key: 'AURORA', label: 'Aurora', description: 'Soft aurora light bands flowing at the top', category: 'Modern & Minimal' },
];
/** Every theme can be chosen for a festival (the birthday confetti stays for birthdays unless HR picks it for a festival) */
export const FESTIVAL_THEME_KEYS = THEMES.map(t => t.key);
export const themeOf = (key?: string) => THEMES.find(t => t.key === key);

/** Birthday Celebration → Birthday Person Animation (NONE = no animation) */
export const BIRTHDAY_SELF_THEMES: (ThemeKey | 'NONE')[] = ['CONFETTI', 'FLOATING_BALLOONS', 'PARTY_POPPERS', 'GIFT_BOXES', 'BIRTHDAY_CANDLES', 'CAKE_ANIMATION', 'SPARKLE_RAIN', 'FLOWER_RAIN', 'ROSE_PETALS', 'FIREFLIES', 'BOKEH_LIGHTS', 'LIGHT_STRINGS', 'FLOATING_LANTERNS', 'GRADIENT_WAVES', 'AURORA', 'ELEGANT', 'NONE'];
/** Colleagues' Birthday Animation — light, professional effects only (NONE = off, the default) */
export const BIRTHDAY_COLLEAGUE_THEMES: (ThemeKey | 'NONE')[] = ['NONE', 'ELEGANT', 'BOKEH_LIGHTS', 'SPARKLE_RAIN', 'FIREFLIES', 'LIGHT_STRINGS', 'ROSE_PETALS', 'GRADIENT_WAVES'];
export const themeLabel = (k?: string) => (k === 'NONE' ? 'None (no animation)' : themeOf(k)?.label || k || '');

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
    kind: 'birthday-self' | 'birthday-colleague' | 'festival' | 'vacation' | 'welcome-self' | 'welcome-colleague';
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
export type EffectData = { type: 'birthday' | 'festival' | 'colleague-birthday'; theme: ThemeKey; key: string; opening: boolean; subtle: boolean };
export type TodayCelebration = { date: string; banner: BannerData | null; colleagues: ColleagueBirthday[]; effect: EffectData | null; birthdaySelf: boolean; /** today's New Member Welcome banners for colleagues (other than `banner`) */ welcomes?: BannerData[] };

/** Built-in banners used when HR has not uploaded / selected one */
export const DEFAULTS = {
    birthdaySelf: { heading: 'Happy Birthday, {firstName}!', subheading: 'Wishing you a wonderful year ahead from everyone at Geeks of Gurukul.', headingColor: '#ffffff', textColor: '#d1fae5', bgColor: '#064e3b', overlayColor: 'rgba(0,0,0,0.25)', align: 'left' as BannerAlign, photoPosition: 'right' as PhotoPosition },
    birthdayColleague: { heading: 'Happy Birthday, {name}!', subheading: 'Wishing our colleague a wonderful year ahead.', headingColor: '#ffffff', textColor: '#e0f2fe', bgColor: '#0c4a6e', overlayColor: 'rgba(0,0,0,0.25)', align: 'left' as BannerAlign, photoPosition: 'right' as PhotoPosition },
    vacation: { subheading: 'Enjoy your holidays and have a wonderful celebration!', headingColor: '#ffffff', textColor: '#e4e4e7', bgColor: '#14532d', overlayColor: 'rgba(0,0,0,0.30)', align: 'left' as BannerAlign },
    festival: { textColor: '#ffffff', bgColor: '#7c2d12' },
    welcomeSelf: { heading: 'Welcome to Geeks of Gurukul, {firstName}!', subheading: 'We are glad to have you with us. Wishing you a great start!', headingColor: '#ffffff', textColor: '#e0e7ff', bgColor: '#312e81', overlayColor: 'rgba(0,0,0,0.25)', align: 'left' as BannerAlign, photoPosition: 'right' as PhotoPosition },
    welcomeColleague: { heading: 'Please welcome {name} to the team!', subheading: 'Our newest team member has joined Geeks of Gurukul. Say hello!', headingColor: '#ffffff', textColor: '#ccfbf1', bgColor: '#134e4a', overlayColor: 'rgba(0,0,0,0.25)', align: 'left' as BannerAlign, photoPosition: 'right' as PhotoPosition },
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
/** New Member Welcome (HR, shown only on the day it is published): the new member's own banner / the colleagues' banner */
export function welcomeBanner(kind: 'welcome-self' | 'welcome-colleague', w: any, person: any) {
    const self = kind === 'welcome-self';
    const t = w ? {
        imageUrl: (self && w.selfImageUrl) || w.imageUrl || undefined,
        greeting: self ? w.selfGreeting : w.greeting, subtext: self ? w.selfSubtext : w.subtext,
        headingColor: w.headingColor, textColor: w.textColor, bgColor: w.bgColor, overlayColor: w.overlayColor, align: w.align, photoPosition: w.photoPosition,
    } : null;
    return fromTemplate(t, self ? DEFAULTS.welcomeSelf : DEFAULTS.welcomeColleague, kind, person);
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