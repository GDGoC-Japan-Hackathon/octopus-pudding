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
