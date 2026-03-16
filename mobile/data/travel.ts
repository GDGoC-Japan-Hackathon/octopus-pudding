export type TripTimeline = {
  id: string;
  time: string;
  place: string;
  memo: string;
};

export type RecommendPlan = {
  id: string;
  title: string;
  location: string;
  author: string;
  likes: number;
  image: string;
  category: string;
};

export type SavedPlan = {
  id: string;
  title: string;
  period: string;
  startDate: string;
  days: number;
  budget: number;
  image: string;
  route: string;
  people: string;
  status: 'completed' | 'upcoming';
  highlights: string[];
};

export type Friend = {
  id: string;
  name: string;
  role: string;
  addedAt: string;
};

export type TripHistory = {
  id: string;
  title: string;
  date: string;
  detail: string;
};

export const weatherMock = {
  location: '東京駅',
  temp: '26°C',
  condition: '晴れ',
};

export const timelineMock: TripTimeline[] = [
  {
    id: 'ts-1',
    time: '10:00',
    place: '東京駅',
    memo: '改札を出て待ち合わせ場所へ移動',
  },
  {
    id: 'ts-2',
    time: '11:00',
    place: '京都駅',
    memo: '観光開始。三条店で朝食',
  },
  {
    id: 'ts-3',
    time: '14:00',
    place: '清水寺',
    memo: 'ゆっくり散策・お土産購入',
  },
];

export const recommendedPlans: RecommendPlan[] = [
  {
    id: 'rec-1',
    title: '京都カフェ旅',
    location: '京都',
    author: '佐藤 健太',
    likes: 1240,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCRcE2C8EgkbmVFpM8pb0LjqQxAwD5JZ_wBHaDld6wzmXof7O0rq0Jowsr34WmS3KseT-IqF0p3WxAw3_a88GMtsypaDmwN3WVWbytgw4FACOqUhWrflUfzdOOdPA6F05VvVZJA9V_6G5z9aE9rwoI2Xo8wIydT5RJMtz98QEN0FoSlesfLG77uBjGKX0zBGrCwfu4Kf04NUxnKGbKgFnby3KbI2hBgYqZ_6kR0cxtHiH5_c1nC4FPcUw_hXT78CS7n2_1AMqniO9Gu',
    category: 'カフェ',
  },
  {
    id: 'rec-2',
    title: '夜景スポット巡り',
    location: '東京',
    author: '田中 舞',
    likes: 850,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDkBQrKxtkwk63NDF9iM2N1llKE_N1gxzW1zdIKpIjKbnDMI2219sQYpen4CHRSD3_uGItySPvssh7w7FtqAfNXIKR1p7u7xYriqFilEbH0zU7CAozx-xl9B92h6-Ujv2HmILGEPOq_YMnD0ECjuYymlNTIzaYDB6R8tOx2ss3kbJE04YC19__lpkBdijkwci1_M_364oCFI9-ZaDEMBgUXNYnBhPlowcHuKSTy1Ej_ULFeNsgm1ZZfPMpzhDbJllQ6Ri-OVv9LUTtT',
    category: '夜景',
  },
  {
    id: 'rec-3',
    title: '大阪絶品グルメ旅',
    location: '大阪',
    author: '伊藤 誠',
    likes: 2105,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDlzxTBRQa5Xep8a6-CyTYH_Wdea0IUP4Y62hdJsx6sSmzKKGwsK8Z6hbHdenkZKn625MCHyNntEima16o4ZdMF2F6IRT2T9VfknpRZxsoELcY_-KDfRRQfu7PCZ5D0ie0tZgw5mCpCCzZ-oz2Co-qUUAb0ac2aepwwXB81Tislw9_9Fd-syfpcnolAt4xmLSfu7JGnsu3Pif_WXLzJ_zT05RUDuP0_3gYEi_vtNGkYM7YIjI4k3Y9kQbLAsoxjbCMN-xvsD4dOkPz7',
    category: 'グルメ',
  },
];

export const savedPlans: SavedPlan[] = [
  {
    id: 'plan-1',
    title: '北部温泉巡り 2泊3日',
    period: '2026/03/14 - 2026/03/16',
    startDate: '2026/03/14',
    days: 3,
    budget: 162000,
    image:
      'https://images.unsplash.com/photo-1470246973918-29a93221c455?auto=format&fit=crop&w=800&q=60',
    route: '東京 → 伊豆 → 下田 → 草津',
    people: '大人2名',
    status: 'upcoming',
    highlights: ['2時間以内の移動経路', '夜景カフェ3軒追加', '温泉時間を1時間延長'],
  },
  {
    id: 'plan-2',
    title: '九州ラーメンめぐり',
    period: '2026/01/10 - 2026/01/13',
    startDate: '2026/01/10',
    days: 4,
    budget: 98000,
    image:
      'https://images.unsplash.com/photo-1528605248634-3fd3c9cb0f5e?auto=format&fit=crop&w=800&q=60',
    route: '福岡 → 長崎 → 熊本',
    people: '1名',
    status: 'completed',
    highlights: ['昼夜で通る名店', '新幹線指定席予約済み'],
  },
  {
    id: 'plan-3',
    title: '瀬戸内離島ドライブ',
    period: '2026/04/05 - 2026/04/07',
    startDate: '2026/04/05',
    days: 2,
    budget: 124000,
    image:
      'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=800&q=60',
    route: '岡山 → 尾道 → 竹原',
    people: '大人3名',
    status: 'upcoming',
    highlights: ['瀬戸大橋スケジュール', '移動時間を短縮する経路提案'],
  },
];

export const createMethods = [
  {
    id: 'create-new',
    title: '最初から作成する',
    description: '目的地、日数、予算を自分で決めてプランを作る',
    icon: 'create',
    target: 'create/new-plan',
  },
  {
    id: 'create-replan',
    title: 'トラブル時に再計画する',
    description: '移動・天候・体調の変化が出た場合に修正',
    icon: 'autorenew',
    target: 'create/replanning',
  },
] as const;

export const friendsMock: Friend[] = [
  { id: 'fr-1', name: '佐藤 亮', role: '同伴者', addedAt: '2026/02/10' },
  { id: 'fr-2', name: '中村 里奈', role: '旅のしおり共有', addedAt: '2026/02/18' },
];

export const tripHistoryMock = [
  {
    id: 'history-1',
    title: '大阪夜景旅',
    date: '2025/12/12',
    detail: '3日間・東京→大阪→神戸',
  },
  {
    id: 'history-2',
    title: '京都寺社巡り',
    date: '2026/01/03',
    detail: '一人旅・2日間・徒歩中心',
  },
];
