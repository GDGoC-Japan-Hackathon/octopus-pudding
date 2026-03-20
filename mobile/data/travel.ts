export type TripTimeline = {
  id: string;
  time: string;
  place: string;
  memo: string;
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
