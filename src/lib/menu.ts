export type Option = { id: string; ar: string; en: string; price: number };

export type Product = {
  id: string;
  category: string;
  ar: string;
  en: string;
  descAr: string;
  descEn: string;
  price: number;
  image: string;
  sizes?: Option[];
  flavors?: Option[];
  badgeAr?: string;
  badgeEn?: string;
};

export const categories = [
  { id: "cakes", ar: "كيك المناسبات", en: "Celebration Cakes" },
  { id: "cheesecake", ar: "تشيز كيك", en: "Cheesecakes" },
  { id: "cupcakes", ar: "كب كيك", en: "Cupcakes" },
  { id: "cookies", ar: "كوكيز وبراوني", en: "Cookies & Brownies" },
  { id: "arabic", ar: "حلويات عربية", en: "Arabic Sweets" },
];

const sizes: Option[] = [
  { id: "s", ar: "صغير (٦ أشخاص)", en: "Small (serves 6)", price: 0 },
  { id: "m", ar: "وسط (١٠ أشخاص)", en: "Medium (serves 10)", price: 8 },
  { id: "l", ar: "كبير (١٦ شخص)", en: "Large (serves 16)", price: 16 },
];

export const products: Product[] = [
  {
    id: "p1",
    category: "cakes",
    ar: "كيك الشوكولاتة البلجيكية",
    en: "Belgian Chocolate Cake",
    descAr: "طبقات كيك شوكولاتة غنية مع غاناش بلجيكي حريري.",
    descEn: "Rich chocolate layers with silky Belgian ganache.",
    price: 24,
    image: "cake-choc",
    sizes,
    flavors: [
      { id: "dark", ar: "شوكولاتة داكنة", en: "Dark chocolate", price: 0 },
      { id: "milk", ar: "شوكولاتة بالحليب", en: "Milk chocolate", price: 0 },
      { id: "nutella", ar: "نوتيلا وبندق", en: "Nutella & hazelnut", price: 3 },
    ],
    badgeAr: "الأكثر طلباً",
    badgeEn: "Best seller",
  },
  {
    id: "p2",
    category: "cakes",
    ar: "كيك الفانيلا والفراولة",
    en: "Vanilla & Strawberry Cake",
    descAr: "إسفنج فانيلا بالزبدة مع كريمة طازجة وفراولة.",
    descEn: "Buttery vanilla sponge, fresh cream and strawberries.",
    price: 22,
    image: "cake-berry",
    sizes,
  },
  {
    id: "p3",
    category: "cakes",
    ar: "كيك الرد فيلفت",
    en: "Red Velvet Cake",
    descAr: "رد فيلفت مخملي مع كريمة الجبن.",
    descEn: "Velvety red velvet with cream cheese frosting.",
    price: 26,
    image: "cake-red",
    sizes,
  },
  {
    id: "p4",
    category: "cheesecake",
    ar: "تشيز كيك لوتس",
    en: "Lotus Cheesecake",
    descAr: "تشيز كيك كريمي بقاعدة بسكويت لوتس.",
    descEn: "Creamy cheesecake on a caramelised Lotus base.",
    price: 20,
    image: "cheesecake",
    sizes,
    badgeAr: "جديد",
    badgeEn: "New",
  },
  {
    id: "p5",
    category: "cheesecake",
    ar: "تشيز كيك التوت",
    en: "Berry Cheesecake",
    descAr: "تشيز كيك بارد مع صوص التوت الطازج.",
    descEn: "Chilled cheesecake with fresh berry compote.",
    price: 21,
    image: "cheesecake",
    sizes,
  },
  {
    id: "p6",
    category: "cupcakes",
    ar: "صندوق كب كيك (٦ حبات)",
    en: "Cupcake Box (6 pcs)",
    descAr: "تشكيلة كب كيك بكريمة الزبدة السويسرية.",
    descEn: "Assorted cupcakes with Swiss buttercream.",
    price: 12,
    image: "cupcakes",
    flavors: [
      { id: "mix", ar: "تشكيلة مختارة", en: "Chef's mix", price: 0 },
      { id: "choc", ar: "شوكولاتة", en: "Chocolate", price: 0 },
      { id: "vanilla", ar: "فانيلا", en: "Vanilla", price: 0 },
    ],
  },
  {
    id: "p7",
    category: "cupcakes",
    ar: "صندوق كب كيك (١٢ حبة)",
    en: "Cupcake Box (12 pcs)",
    descAr: "مثالي للمشاركة في المناسبات الصغيرة.",
    descEn: "Perfect for sharing at small gatherings.",
    price: 22,
    image: "cupcakes",
  },
  {
    id: "p8",
    category: "cookies",
    ar: "كوكيز الشوكولاتة",
    en: "Chocolate Chunk Cookies",
    descAr: "طرية من الداخل ومقرمشة من الأطراف.",
    descEn: "Soft centres, crisp golden edges.",
    price: 9,
    image: "cookies",
    flavors: [
      { id: "classic", ar: "كلاسيك", en: "Classic", price: 0 },
      { id: "double", ar: "دبل شوكولاتة", en: "Double chocolate", price: 1 },
      { id: "pistachio", ar: "فستق حلبي", en: "Pistachio", price: 2 },
    ],
  },
  {
    id: "p9",
    category: "cookies",
    ar: "براوني فادج",
    en: "Fudge Brownies",
    descAr: "براوني كثيف بالشوكولاتة الداكنة.",
    descEn: "Dense dark chocolate fudge brownies.",
    price: 11,
    image: "brownies",
  },
  {
    id: "p10",
    category: "arabic",
    ar: "كنافة نابلسية",
    en: "Nabulsi Knafeh",
    descAr: "كنافة بالجبنة الطازجة والقطر.",
    descEn: "Fresh cheese knafeh in fragrant syrup.",
    price: 14,
    image: "knafeh",
    badgeAr: "مفضّل الأردن",
    badgeEn: "Jordan favourite",
  },
  {
    id: "p11",
    category: "arabic",
    ar: "بقلاوة بالفستق",
    en: "Pistachio Baklava",
    descAr: "طبقات رقيقة محمّصة بالسمن والفستق.",
    descEn: "Paper-thin layers with butter and pistachio.",
    price: 16,
    image: "baklava",
  },
  {
    id: "p12",
    category: "arabic",
    ar: "مهلبية الورد",
    en: "Rose Mahalabia",
    descAr: "حلوى باردة بماء الورد والفستق.",
    descEn: "Chilled rose water pudding with pistachio.",
    price: 8,
    image: "mahalabia",
  },
];

export const builderSizes: Option[] = [
  { id: "b6", ar: "٦ أشخاص", en: "Serves 6", price: 26 },
  { id: "b10", ar: "١٠ أشخاص", en: "Serves 10", price: 34 },
  { id: "b16", ar: "١٦ شخص", en: "Serves 16", price: 46 },
  { id: "b2", ar: "طابقين", en: "Two tiers", price: 68 },
];

export const builderFlavors: Option[] = [
  { id: "f1", ar: "شوكولاتة بلجيكية", en: "Belgian chocolate", price: 0 },
  { id: "f2", ar: "فانيلا بالزبدة", en: "Vanilla bean", price: 0 },
  { id: "f3", ar: "رد فيلفت", en: "Red velvet", price: 3 },
  { id: "f4", ar: "فستق حلبي", en: "Pistachio", price: 5 },
];

export const builderFillings: Option[] = [
  { id: "i1", ar: "كريمة طازجة", en: "Fresh cream", price: 0 },
  { id: "i2", ar: "غاناش شوكولاتة", en: "Chocolate ganache", price: 2 },
  { id: "i3", ar: "لوتس كراميل", en: "Lotus caramel", price: 3 },
  { id: "i4", ar: "فراولة طازجة", en: "Fresh strawberry", price: 3 },
];

export const builderFrostings: Option[] = [
  { id: "r1", ar: "كريمة الزبدة", en: "Buttercream", price: 0 },
  { id: "r2", ar: "فوندان أنيق", en: "Smooth fondant", price: 6 },
  { id: "r3", ar: "دريب شوكولاتة", en: "Chocolate drip", price: 4 },
  { id: "r4", ar: "ذهبي فاخر", en: "Gold leaf luxe", price: 10 },
];

export const DELIVERY_FEE = 3;
export const WHATSAPP = "962779179995";
