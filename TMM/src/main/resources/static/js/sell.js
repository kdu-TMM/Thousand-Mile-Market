/* ===== 인증 가드 ===== */
function checkSellAuth() {
    const guard   = document.getElementById('sellAuthGuard');
    const content = document.getElementById('sellContent');
    if (!guard || !content) return;

    const user = window.auth?.currentUser;
    if (user) {
        guard.style.display   = 'none';
        content.style.display = 'block';
    } else if (content.style.display !== 'block') {
        /* 콘텐츠가 이미 표시 중(서버 세션으로 열린 경우)이면 건드리지 않음 */
        guard.style.display   = 'flex';
    }
}
window.addEventListener('firebase-ready', checkSellAuth);
window.addEventListener('auth-changed', checkSellAuth);
if (window.firebaseReady) checkSellAuth();

function toggleAuctionFields(radio) {
    const isAuction = radio.value === 'auction';
    document.getElementById('auctionStartRow').style.display = isAuction ? 'flex' : 'none';
    document.getElementById('auctionTimeRow').style.display  = isAuction ? 'flex' : 'none';
    document.getElementById('normalPriceRow').style.display  = isAuction ? 'none' : 'flex';
}

/* ===== 이미지 미리보기 (리스트형) ===== */
const uploadedFiles = [];

document.addEventListener('DOMContentLoaded', function () {
    const imgInput = document.getElementById('imgInput');
    if (!imgInput) return;

    imgInput.addEventListener('change', function (e) {
        Array.from(e.target.files).forEach(file => {
            if (uploadedFiles.length >= 10) return;
            const idx = uploadedFiles.length;
            uploadedFiles.push(file);
            const reader = new FileReader();
            reader.onload = ev => addPreviewItem(ev.target.result, idx);
            reader.readAsDataURL(file);
        });
        document.getElementById('photoCount').textContent = uploadedFiles.length + '/10';
        this.value = '';
    });

});

function addPreviewItem(src, idx) {
    const list = document.getElementById('img-preview-list');
    const li = document.createElement('li');
    li.className = 'img-preview-item';
    li.dataset.idx = idx;
    li.innerHTML = `<img src="${src}" alt="미리보기">
        <button class="img-remove-btn" onclick="removePhoto(${idx})">✕</button>`;
    list.appendChild(li);
}

function removePhoto(idx) {
    uploadedFiles.splice(idx, 1);
    /* 전체 미리보기 재렌더 */
    document.querySelectorAll('.img-preview-item').forEach(el => el.remove());
    uploadedFiles.forEach((file, i) => {
        const reader = new FileReader();
        reader.onload = ev => addPreviewItem(ev.target.result, i);
        reader.readAsDataURL(file);
    });
    document.getElementById('photoCount').textContent = uploadedFiles.length + '/10';
}

/* ===== 등록 ===== */
let _pendingSellData = null;

function doSell() {
    const title       = document.getElementById('sellTitle').value.trim();
    const category    = document.getElementById('sellCategory').value;
    const condition   = document.getElementById('sellCondition').value;
    const sellType    = document.querySelector('input[name="sellType"]:checked')?.value;
    const description = document.getElementById('sellDescription').value.trim();
    const sido        = document.getElementById('regionSido').value;
    const sigungu     = document.getElementById('regionSigungu').value;
    const dong        = document.getElementById('regionDong').value;

    function msg(text, ok) {
        const el = document.getElementById('sellMsg');
        el.textContent = text;
        el.className = 'sell-msg' + (ok ? ' ok' : '');
    }

    if (uploadedFiles.length === 0) return msg('사진을 1장 이상 첨부해 주세요.');
    if (!title)       return msg('상품 제목을 입력해 주세요.');
    if (!category)    return msg('카테고리를 선택해 주세요.');
    if (!condition)   return msg('상품 상태를 선택해 주세요.');
    if (!description) return msg('상품 설명을 입력해 주세요.');
    const sigunguEl = document.getElementById('regionSigungu');
    const dongEl    = document.getElementById('regionDong');
    const needSigungu = sigunguEl.style.display !== 'none' && sigunguEl.options.length > 1;
    const needDong    = dongEl.style.display    !== 'none' && dongEl.options.length    > 1;
    if (!sido) return msg('시/도를 선택해 주세요.');
    if (needSigungu && !sigungu) return msg('시/군/구를 선택해 주세요.');
    if (needDong    && !dong)    return msg('읍/면/동을 선택해 주세요.');

    if (!window.db || !window.auth?.currentUser) return msg('로그인이 필요합니다.');

    let priceInfo = {};
    if (sellType === 'auction') {
        const startPrice = parseInt(document.getElementById('sellStartPrice').value);
        if (!startPrice || startPrice <= 0) return msg('경매 시작가를 입력해 주세요.');
        const days = parseInt(document.getElementById('sellAuctionTime').value);
        const auctionEnd = new Date(Date.now() + days * 86400 * 1000).toISOString();
        priceInfo = { startPrice, currentPrice: startPrice, bidCount: 0, auctionEnd };
    } else {
        const price = parseInt(document.getElementById('sellPrice').value);
        if (!price || price <= 0) return msg('판매 가격을 입력해 주세요.');
        const nego = document.getElementById('sellNego').checked;
        priceInfo = { price, nego };
    }

    const user = window.auth.currentUser;
    const docRef = window.fs.doc(window.fs.collection(window.db, 'products'));
    _pendingSellData = {
        docRef,
        data: {
            id:             docRef.id,
            title, category, condition,
            type:           sellType,
            description,
            region:         [sido, sigungu, dong].filter(Boolean).join(' '),
            status:         sellType === 'auction' ? '경매중' : '판매중',
            sellerUid:      user.uid,
            sellerNickname: user.displayName || '',
            imageUrls:      [],
            views: 0, wishes: 0,
            date:           new Date().toISOString(),
            ...priceInfo
        }
    };

    document.getElementById('sellConfirmOverlay').style.display = 'flex';
}

function closeSellConfirm() {
    document.getElementById('sellConfirmOverlay').style.display = 'none';
    _pendingSellData = null;
}

function compressImage(file, maxSize = 1200, quality = 0.8) {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            let { width, height } = img;
            if (width > maxSize || height > maxSize) {
                if (width > height) { height = Math.round(height * maxSize / width); width = maxSize; }
                else                { width  = Math.round(width  * maxSize / height); height = maxSize; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            canvas.toBlob(blob => resolve(blob || file), 'image/jpeg', quality);
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
        img.src = url;
    });
}

async function uploadImages(uid, files) {
    const { ref, uploadBytes, getDownloadURL } = window.storageUtils;
    const urls = [];
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const compressed = await compressImage(file);
        const ext = file.name.replace(/.*\./, '') || 'jpg';
        const path = `products/${uid}/${Date.now()}_${i}.jpg`;
        const snap = await uploadBytes(ref(window.storage, path), compressed, { contentType: 'image/jpeg' });
        urls.push(await getDownloadURL(snap.ref));
    }
    return urls;
}

async function doSellConfirmed() {
    if (!_pendingSellData) return;
    const { docRef, data } = _pendingSellData;
    _pendingSellData = null;
    document.getElementById('sellConfirmOverlay').style.display = 'none';

    function msg(text, ok) {
        const el = document.getElementById('sellMsg');
        el.textContent = text;
        el.className = 'sell-msg' + (ok ? ' ok' : '');
    }

    const btn = document.querySelector('.form-actions .btn-submit');
    btn.disabled = true;
    btn.textContent = '등록 중...';

    if (uploadedFiles.length > 0 && window.storageUtils && window.storage) {
        try {
            data.imageUrls = await uploadImages(data.sellerUid, uploadedFiles);
        } catch (e) {
            console.warn('이미지 업로드 실패:', e);
        }
    }

    window.fs.setDoc(docRef, data)
        .then(() => {
            msg('등록이 완료되었습니다!', true);
            btn.textContent = '등록하기';
            btn.disabled = false;
            setTimeout(() => location.href = '/product/' + docRef.id, 1000);
        })
        .catch(e => {
            msg('오류가 발생했습니다: ' + e.message);
            btn.textContent = '등록하기';
            btn.disabled = false;
        });
}

/* ===== 지역 셀렉트박스 ===== */
const regionData = {
    '서울특별시': {
        '강남구': ['역삼1동','역삼2동','개포1동','개포2동','청담동','삼성1동','삼성2동','논현1동','논현2동','압구정동','신사동','도곡1동','도곡2동'],
        '강서구': ['가양1동','가양2동','가양3동','화곡본동','화곡1동','화곡2동','화곡3동','발산1동','우장산동','방화1동','방화2동','방화3동','마곡동'],
        '마포구': ['공덕동','아현동','도화동','용강동','대흥동','신수동','서강동','서교동','합정동','망원1동','망원2동','연남동','성산1동','성산2동','상암동'],
        '종로구': ['청운효자동','사직동','삼청동','부암동','평창동','무악동','교남동','가회동','종로1·2·3·4가동','혜화동','창신1동','창신2동','창신3동','숭인1동','숭인2동'],
        '영등포구': ['영등포본동','신길1동','신길3동','신길4동','신길5동','대림1동','대림2동','대림3동','도림동','문래동','양평1동','양평2동','당산1동','당산2동'],
        '관악구': [], '광진구': [], '구로구': [], '금천구': [], '노원구': [],
        '도봉구': [], '동대문구': [], '동작구': [], '서대문구': [], '서초구': [],
        '성동구': [], '성북구': [], '송파구': [], '양천구': [], '용산구': [],
        '은평구': [], '중구': [], '중랑구': []
    },
    '경기도': {
        '의정부시': ['신곡1동','신곡2동','의정부1동','의정부2동','의정부3동','호원1동','호원2동','장암동','녹양동','가능동','흥선동','효자동','민락동','낙양동'],
        '수원시':   ['장안구','권선구','팔달구','영통구'],
        '성남시':   ['수정구','중원구','분당구'],
        '고양시':   ['덕양구','일산동구','일산서구'],
        '용인시':   ['처인구','기흥구','수지구'],
        '부천시':   ['원미구','소사구','오정구'],
        '안산시':   ['단원구','상록구'],
        '남양주시': ['화도읍','오남읍','진건읍','별내면','퇴계원면'],
        '화성시':   ['봉담읍','향남읍','남양읍','우정읍','장안면'],
        '평택시':   ['평택동','비전1동','비전2동','통복동','중앙동'],
        '안양시': [], '시흥시': [], '파주시': [], '김포시': [], '광주시': [],
        '광명시': [], '하남시': [], '오산시': [], '안성시': [], '이천시': [],
        '포천시': [], '양주시': [], '구리시': [], '여주시': [], '동두천시': [],
        '과천시': [], '의왕시': [], '군포시': [],
        '가평군': [], '양평군': [], '연천군': []
    },
    '인천광역시': {
        '남동구': ['구월1동','구월2동','구월3동','구월4동','간석1동','간석2동','간석3동','간석4동','만수1동','만수2동','만수3동','만수4동','논현1동','논현고잔동','논현2동'],
        '연수구': ['옥련1동','옥련2동','선학동','연수1동','연수2동','연수3동','청학동','동춘1동','동춘2동','동춘3동','송도1동','송도2동','송도3동','송도4동'],
        '부평구': ['부평1동','부평2동','부평3동','부평4동','부평5동','부평6동','십정1동','십정2동','산곡1동','산곡2동','산곡3동','산곡4동','갈산1동','갈산2동','삼산1동','삼산2동'],
        '계양구': [], '미추홀구': [], '서구': [], '동구': [], '중구': [],
        '강화군': [], '옹진군': []
    },
    '부산광역시': {
        '해운대구': ['우동','중동','좌동','송정동','반여1동','반여2동','반여3동','반여4동','반송1동','반송2동','석대동','재송1동','재송2동'],
        '수영구':   ['남천1동','남천2동','수영동','망미1동','망미2동','광안1동','광안2동','광안3동','광안4동'],
        '사상구':   ['삼락동','모라1동','모라3동','덕포1동','덕포2동','괘법동','감전동','주례1동','주례2동','주례3동','학장동','엄궁동'],
        '강서구': [], '금정구': [], '남구': [], '동구': [], '동래구': [],
        '부산진구': [], '북구': [], '사하구': [], '서구': [], '연제구': [],
        '영도구': [], '중구': [], '기장군': []
    },
    '대구광역시': {
        '달서구': [], '달성군': [], '동구': [], '북구': [], '서구': [],
        '남구': [], '중구': [], '수성구': []
    },
    '광주광역시': {
        '광산구': [], '남구': [], '동구': [], '북구': [], '서구': []
    },
    '대전광역시': {
        '대덕구': [], '동구': [], '서구': [], '유성구': [], '중구': []
    },
    '울산광역시': {
        '남구': [], '동구': [], '북구': [], '중구': [], '울주군': []
    },
    '세종특별자치시': {
        '조치원읍': [], '한솔동': [], '도담동': [], '아름동': [], '종촌동': [],
        '고운동': [], '보람동': [], '새롬동': [], '나성동': [], '다정동': [],
        '소담동': [], '어진동': [], '반곡동': [], '해밀동': []
    },
    '강원도': {
        '춘천시': [], '원주시': [], '강릉시': [], '동해시': [], '태백시': [],
        '속초시': [], '삼척시': [], '홍천군': [], '횡성군': [], '영월군': [],
        '평창군': [], '정선군': [], '철원군': [], '화천군': [], '양구군': [],
        '인제군': [], '고성군': [], '양양군': []
    },
    '충청북도': {
        '청주시': [], '충주시': [], '제천시': [], '보은군': [], '옥천군': [],
        '영동군': [], '증평군': [], '진천군': [], '괴산군': [], '음성군': [], '단양군': []
    },
    '충청남도': {
        '천안시': [], '공주시': [], '보령시': [], '아산시': [], '서산시': [],
        '논산시': [], '계룡시': [], '당진시': [], '금산군': [], '부여군': [],
        '서천군': [], '청양군': [], '홍성군': [], '예산군': [], '태안군': []
    },
    '전라북도': {
        '전주시': [], '군산시': [], '익산시': [], '정읍시': [], '남원시': [],
        '김제시': [], '완주군': [], '진안군': [], '무주군': [], '장수군': [],
        '임실군': [], '순창군': [], '고창군': [], '부안군': []
    },
    '전라남도': {
        '목포시': [], '여수시': [], '순천시': [], '나주시': [], '광양시': [],
        '담양군': [], '곡성군': [], '구례군': [], '고흥군': [], '보성군': [],
        '화순군': [], '장흥군': [], '강진군': [], '해남군': [], '영암군': [],
        '무안군': [], '함평군': [], '영광군': [], '장성군': [], '완도군': [],
        '진도군': [], '신안군': []
    },
    '경상북도': {
        '포항시': [], '경주시': [], '김천시': [], '안동시': [], '구미시': [],
        '영주시': [], '영천시': [], '상주시': [], '문경시': [], '경산시': [],
        '의성군': [], '청송군': [], '영양군': [], '영덕군': [], '청도군': [],
        '고령군': [], '성주군': [], '칠곡군': [], '예천군': [], '봉화군': [],
        '울진군': [], '울릉군': []
    },
    '경상남도': {
        '창원시': [], '진주시': [], '통영시': [], '사천시': [], '김해시': [],
        '밀양시': [], '거제시': [], '양산시': [], '의령군': [], '함안군': [],
        '창녕군': [], '고성군': [], '남해군': [], '하동군': [], '산청군': [],
        '함양군': [], '거창군': [], '합천군': []
    },
    '제주특별자치도': {
        '제주시': [], '서귀포시': []
    }
};

function updateSigungu() {
    const sido      = document.getElementById('regionSido').value;
    const sigunguEl = document.getElementById('regionSigungu');
    const dongEl    = document.getElementById('regionDong');

    sigunguEl.innerHTML = '<option value="">시/군/구 선택</option>';
    dongEl.innerHTML    = '<option value="">읍/면/동 선택</option>';
    dongEl.style.display = 'none';

    if (sido && regionData[sido] && Object.keys(regionData[sido]).length) {
        Object.keys(regionData[sido]).forEach(sg => {
            sigunguEl.innerHTML += `<option value="${sg}">${sg}</option>`;
        });
        sigunguEl.style.display = '';
    } else {
        sigunguEl.style.display = 'none';
    }
}

function updateDong() {
    const sido   = document.getElementById('regionSido').value;
    const sg     = document.getElementById('regionSigungu').value;
    const dongEl = document.getElementById('regionDong');

    dongEl.innerHTML = '<option value="">읍/면/동 선택</option>';
    if (sido && sg && regionData[sido]?.[sg]?.length) {
        regionData[sido][sg].forEach(d => {
            dongEl.innerHTML += `<option value="${d}">${d}</option>`;
        });
        dongEl.style.display = '';
    } else {
        dongEl.style.display = 'none';
    }
}
