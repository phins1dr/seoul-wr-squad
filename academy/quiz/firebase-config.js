/* 공유 랭킹(Firebase) 설정
   Firebase 콘솔 → 프로젝트 설정 → 내 앱(웹) → "SDK 설정 및 구성"에 나오는 값을 그대로 붙여넣으세요.
   apiKey가 비어 있으면 공유 랭킹은 '준비 중'으로 보이고, 나머지 퀴즈·등급은 그대로 동작합니다.
   (웹 apiKey는 비밀번호가 아니라 공개되는 값입니다. 보안은 firestore.rules가 맡습니다.)
   테스트: 주소 뒤에 ?mock=1 을 붙이면 서버 없이 이 브라우저 안의 가짜 랭킹으로 동작합니다. */
window.FIREBASE_CONFIG = {
  apiKey: 'AIzaSyC7XmqS9j4qzqKHZgkeF6m6GhZacFDXUBU',
  authDomain: 'wr-quiz-fceaa.firebaseapp.com',
  projectId: 'wr-quiz-fceaa',
  storageBucket: 'wr-quiz-fceaa.firebasestorage.app',
  messagingSenderId: '71974210293',
  appId: '1:71974210293:web:f0da4eb94d73427e0213bc'
};
