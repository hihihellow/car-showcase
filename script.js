import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

console.log("script.js 有執行");
console.log("目前網址:", window.location.href);
console.log("Supabase client ready");

const supabaseUrl = "https://sszyqmgrlxpwonfidkcr.supabase.co";
const supabaseKey = "sb_publishable_DxGd6Yu_mXB1YqiUTxJdqA_CT17Rv27";

const supabase = createClient(supabaseUrl, supabaseKey);

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;

    reader.readAsDataURL(file);
  });  
}

let cars = [];
let filteredCars = [];


// =========================
// 首頁功能
// =========================
let currentPage = 1;
const carsPerPage = 12;
const carList = document.getElementById("carList");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const regionFilter = document.getElementById("regionFilter");
const priceFilter = document.getElementById("priceFilter");
const headerSearchInput = document.getElementById("headerSearchInput");
const mobileSearchBtn = document.getElementById("mobileSearchBtn");
const headerSearch = document.querySelector(".header-search");

if (headerSearchInput && searchInput) {
  headerSearchInput.addEventListener("input", () => {
    searchInput.value = headerSearchInput.value;
    filterCars();
  });
}

if (mobileSearchBtn && headerSearch && headerSearchInput) {
  mobileSearchBtn.addEventListener("click", () => {
    headerSearch.classList.toggle("show");
    if (headerSearch.classList.contains("show")) {
      headerSearchInput.focus();
    }
  });
}

function hidePageLoader() {
  const loader = document.getElementById("pageLoader");
  if (loader) {
    loader.classList.add("hide");
  }
}

async function getCurrentUser() {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) {
    console.error("取得登入使用者失敗:", error);
    return null;
  }

  return user;
}

function normalizeCarId(carId) {
  return String(carId);
}

async function getFavoriteCarIds() {
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("favorites")
    .select("car_id")
    .eq("user_id", user.id);

  if (error) {
    console.error("讀取收藏失敗:", error);
    return [];
  }

  return (data || []).map((item) => String(item.car_id));
}

function setFavoriteButtonState(btn, isActive) {
  if (!btn) return;

  btn.classList.toggle("active", isActive);

  if (btn.classList.contains("detail-favorite")) {
    btn.textContent = isActive ? "❤️ 已收藏" : "🤍 收藏";
  } else {
    btn.textContent = isActive ? "❤️" : "🤍";
  }
}

async function toggleFavorite(carId, btn) {
  const user = await getCurrentUser();

  if (!user) {
    alert("請先登入會員再使用收藏功能");
    window.location.href = "login.html";
    return;
  }

  const normalizedCarId = normalizeCarId(carId);

  const { data: existing, error: existingError } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("car_id", normalizedCarId)
    .maybeSingle();

  if (existingError) {
    console.error("檢查收藏狀態失敗:", existingError);
    alert("收藏功能發生錯誤，請稍後再試");
    return;
  }

  if (existing) {
    const { error: deleteError } = await supabase
      .from("favorites")
      .delete()
      .eq("id", existing.id);

    if (deleteError) {
      console.error("取消收藏失敗:", deleteError);
      alert("取消收藏失敗，請稍後再試");
      return;
    }

    setFavoriteButtonState(btn, false);
  } else {
    const { error: insertError } = await supabase
      .from("favorites")
      .insert({
        user_id: user.id,
        car_id: normalizedCarId
      });

    if (insertError) {
      console.error("加入收藏失敗:", insertError);
      alert("加入收藏失敗，請稍後再試");
      return;
    }

    setFavoriteButtonState(btn, true);
  }

  if (window.location.pathname.includes("member.html")) {
    loadFavoriteCars();
  }
}

async function setupFavoriteButtons() {
  const buttons = document.querySelectorAll(".favorite-btn:not(.detail-favorite)");
  if (buttons.length === 0) return;

  const favoriteIds = await getFavoriteCarIds();

  buttons.forEach((btn) => {
    const carId = normalizeCarId(btn.dataset.id);
    const isActive = favoriteIds.includes(carId);

    setFavoriteButtonState(btn, isActive);

    btn.onclick = null;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleFavorite(carId, btn);
    });
  });
}

function getCompareIds() {
  return JSON.parse(localStorage.getItem("compareCars") || "[]");
}

function saveCompareIds(ids) {
  localStorage.setItem("compareCars", JSON.stringify(ids));
}

function setupCompareButtons() {
  document.querySelectorAll(".compare-btn").forEach((btn) => {
    const ids = getCompareIds();
    btn.classList.toggle("active", ids.includes(String(btn.dataset.id)));
    btn.textContent = ids.includes(String(btn.dataset.id)) ? "✓" : "⇄";

    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      let compareIds = getCompareIds();
      const id = String(btn.dataset.id);

      if (compareIds.includes(id)) {
        compareIds = compareIds.filter((item) => item !== id);
      } else {
        if (compareIds.length >= 3) {
          alert("最多只能比較 3 台車。");
          return;
        }

        compareIds.push(id);
      }

      saveCompareIds(compareIds);
      setupCompareButtons();
      renderCompareBar();
    };
  });
}

function renderCompareBar() {
  let bar = document.getElementById("compareFloatBar");
  const compareIds = getCompareIds();

  if (compareIds.length === 0) {
    if (bar) bar.remove();
    return;
  }

  if (!bar) {
    bar = document.createElement("div");
    bar.id = "compareFloatBar";
    bar.className = "compare-float-bar";
    document.body.appendChild(bar);
  }

  bar.innerHTML = `
    <div>
      已加入比較：<strong>${compareIds.length}/3</strong>
    </div>

    <div class="compare-float-actions">
      <button id="clearCompareBtn" type="button">清除</button>
      <button id="startCompareBtn" type="button">開始比較</button>
    </div>
  `;

  document.getElementById("clearCompareBtn").onclick = () => {
    saveCompareIds([]);
    renderCompareBar();
    setupCompareButtons();
  };

  document.getElementById("startCompareBtn").onclick = () => {
    if (compareIds.length < 2) {
      alert("至少選 2 台車才能比較。");
      return;
    }

    window.location.href = "compare.html";
  };
}

async function loadCarsFromSupabase() {
  const { data, error } = await supabase
    .from("cars")
    .select("*")
    .eq("status", "active")
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("讀取 cars 失敗:", error);
    return [];
  }

  const { data: activeStores, error: storeError } = await supabase
    .from("stores")
    .select("id")
    .eq("status", "active");

  if (storeError) {
    console.error("讀取 active stores 失敗:", storeError);
    return data || [];
  }

  const activeStoreIds = new Set((activeStores || []).map((store) => store.id));

  return (data || []).filter((car) => {
    if (!car.store_id) return true;
    return activeStoreIds.has(car.store_id);
  });
}

function renderCars(carArray) {
  if (!carList) return;

  carList.innerHTML = "";

  const start = (currentPage - 1) * carsPerPage;
  const end = start + carsPerPage;
  const pageCars = carArray.slice(start, end);

  if (pageCars.length === 0) {
    carList.innerHTML = `<p>目前沒有符合條件的車輛。</p>`;
    return;
  }

  pageCars.forEach(car => {
    const card = document.createElement("div");
    card.className = car.is_featured
      ? "car-card featured-card"
      : "car-card";

    card.innerHTML = `
      <button class="favorite-btn" data-id="${car.id}" type="button">🤍</button>
      <button class="compare-btn" data-id="${car.id}" type="button">⇄</button>

      <a href="detail.html?id=${car.id}" class="car-link">
        <img src="${car.image}" alt="${car.title}">
        ${car.is_featured ? `<div class="featured-badge">精選</div>` : ""}
        <div class="car-content">
          <h2 class="car-title">${car.title}</h2>
          <div class="card-price">NT$ ${Number(car.price).toLocaleString()}</div>
          <div class="car-meta">
            ${car.category || "-"}｜${car.region || "-"}｜${car.year ? car.year + " 年" : "-"}
          </div>
        </div>
      </a>
    `;

    carList.appendChild(card);
  });

  setupFavoriteButtons();
  setupCompareButtons();
  renderCompareBar();
  renderPagination(carArray.length);
}

function filterCars() {
  if (!searchInput || !categoryFilter || !regionFilter || !priceFilter) return;

  currentPage = 1;
  
  const keyword = searchInput.value.toLowerCase().trim();
  const selectedCategory = categoryFilter.value;
  const selectedRegion = regionFilter.value;
  const selectedPrice = priceFilter.value;

  filteredCars = cars.filter(car => {
    const matchKeyword = car.title.toLowerCase().includes(keyword);

    const matchCategory =
      selectedCategory === "all" || car.category === selectedCategory;

    const matchRegion =
      selectedRegion === "all" || car.region === selectedRegion;

    let matchPrice = true;
    if (selectedPrice !== "all") {
      const [min, max] = selectedPrice.split("-").map(Number);
      matchPrice = car.price >= min && car.price <= max;
    }

    return matchKeyword && matchCategory && matchRegion && matchPrice;
  });

  renderCars(filteredCars);
}

if (carList) {
  loadCarsFromSupabase().then((data) => {
    cars = data;
    filteredCars = data;
    renderCars(filteredCars);
  });
}

if (searchInput && categoryFilter && regionFilter && priceFilter) {
  searchInput.addEventListener("input", filterCars);
  categoryFilter.addEventListener("change", filterCars);
  regionFilter.addEventListener("change", filterCars);
  priceFilter.addEventListener("change", filterCars);
}

// =========================
// 發文頁功能
// =========================
const addCarBtn = document.getElementById("addCarBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const editModeText = document.getElementById("editModeText");

let editingCarId = null;
let oldImages = [];
let selectedImageFiles = [];

const imageInput = document.getElementById("imageInput");
const imagePreviewList = document.getElementById("imagePreviewList");

function renderImagePreview() {
  if (!imagePreviewList) return;

  imagePreviewList.innerHTML = "";

  selectedImageFiles.forEach((file, index) => {
    const imageUrl = URL.createObjectURL(file);

    const item = document.createElement("div");
    item.className = "image-preview-item";

    item.innerHTML = `
      <div class="preview-cover-badge">${index === 0 ? "封面" : `第 ${index + 1} 張`}</div>
      <img src="${imageUrl}" alt="preview">
      <div class="preview-actions">
        <button type="button" class="preview-up-btn" data-index="${index}">上移</button>
        <button type="button" class="preview-down-btn" data-index="${index}">下移</button>
        <button type="button" class="preview-remove-btn" data-index="${index}">刪除</button>
      </div>
    `;

    imagePreviewList.appendChild(item);
  });

  document.querySelectorAll(".preview-up-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.index);
      if (index <= 0) return;

      const temp = selectedImageFiles[index - 1];
      selectedImageFiles[index - 1] = selectedImageFiles[index];
      selectedImageFiles[index] = temp;

      renderImagePreview();
    });
  });

  document.querySelectorAll(".preview-down-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.index);
      if (index >= selectedImageFiles.length - 1) return;

      const temp = selectedImageFiles[index + 1];
      selectedImageFiles[index + 1] = selectedImageFiles[index];
      selectedImageFiles[index] = temp;

      renderImagePreview();
    });
  });

  document.querySelectorAll(".preview-remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.index);
      selectedImageFiles.splice(index, 1);
      renderImagePreview();
    });
  });
}

if (imageInput) {
  imageInput.addEventListener("change", () => {
    selectedImageFiles = Array.from(imageInput.files);
    renderImagePreview();
  });
}

if (addCarBtn) {
  addCarBtn.addEventListener("click", async () => {
    const title = document.getElementById("titleInput").value.trim();
    const brand = document.getElementById("brandInput").value.trim();
    const model = document.getElementById("modelInput").value.trim();
    const year = Number(document.getElementById("yearInput").value);
    const cc = Number(document.getElementById("ccInput").value);

    const price = Number(document.getElementById("priceInput").value);
    const region = document.getElementById("regionInput").value.trim();
    const category = document.getElementById("categoryInput").value.trim();

    const mileage = Number(document.getElementById("mileageInput").value);
    const color = document.getElementById("colorInput").value.trim();

    const equipment = document.getElementById("equipmentInput").value.trim();
    const description = document.getElementById("descInput").value.trim();

    if (
      !title ||
      !brand ||
      !model ||
      Number.isNaN(year) ||
      Number.isNaN(cc) ||
      Number.isNaN(price) ||
      !region ||
      !category ||
      !description
    ) {
      alert("請把基本欄位填完整");
      return;
    }

    if (!editingCarId && selectedImageFiles.length === 0) {
      alert("請至少上傳一張照片");
      return;
    }

    let images = [];

    if (selectedImageFiles.length > 0) {
      for (let i = 0; i < selectedImageFiles.length; i++) {
        const base64 = await fileToBase64(selectedImageFiles[i]);
        images.push(base64);
      }
    } else {
      images = oldImages;
    }

    if (!images || images.length === 0) {
      images = oldImages;
    }
    let savedCar = null;

    if (editingCarId) {
      let updateQuery = supabase
        .from("cars")
        .update({
          title,
          brand,
          model,
          year,
          cc,
          price,
          region,
          category,
          mileage: Number.isNaN(mileage) ? null : mileage,
          color: color || null,
          description,
          equipment: equipment || null,
          image: images && images.length > 0 ? images[0] : oldImages[0]
        })
        .eq("id", Number(editingCarId));

      if (isSellerDashboard && currentSellerStore) {
        updateQuery = updateQuery.eq("store_id", currentSellerStore.id);
      }

      const { data: updatedCar, error: updateError } = await updateQuery
        .select()
        .maybeSingle();

      if (updateError) {
        console.error("更新車輛失敗:", updateError);
        alert("更新車輛失敗，請看 Console");
        return;
      }

      if (!updatedCar) {
        alert("更新失敗：找不到這台車，可能已經被刪除，或不是你的車。");
        return;
      }

      savedCar = updatedCar;

      if (selectedImageFiles.length > 0) {
        await supabase
          .from("car_images")
          .delete()
          .eq("car_id", Number(editingCarId));

        const imageRows = images.map((img, index) => ({
          car_id: Number(editingCarId),
          image_url: img,
          sort_order: index
        }));

        const { error: imagesError } = await supabase
          .from("car_images")
          .insert(imageRows);

        if (imagesError) {
          console.error("更新圖片失敗:", imagesError);
      alert("車輛已更新，但圖片更新失敗，請看 Console");
          return;
        }
      }

      alert("車輛更新成功！");
    } else {
      const { data: lastCar, error: adminNoError } = await supabase
        .from("cars")
        .select("admin_no")
        .not("admin_no", "is", null)
        .order("admin_no", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (adminNoError) {
        console.error("取得車號失敗:", adminNoError);
        alert("取得車號失敗，請看 Console");
        return;
      }

      const nextAdminNo = lastCar?.admin_no ? Number(lastCar.admin_no) + 1 : 1;

      let storeId = null;

      if (isSellerDashboard) {
        if (!currentSellerStore) {
          currentSellerStore = await getMyStore();
        }

        if (!currentSellerStore) {
           alert("找不到你的車行資料，無法新增車輛。");
          return;
        }

        storeId = currentSellerStore.id;
      }

      const { data: insertedCar, error: carError } = await supabase
        .from("cars")
        .insert([
          {
            store_id: storeId,
            admin_no: nextAdminNo,
            title,
            brand,
            model,
            year,
            cc,
            price,
            region,
            category,
            mileage: Number.isNaN(mileage) ? null : mileage,
            color: color || null,
            description,
            equipment: equipment || null,
            image: images && images.length > 0 ? images[0] : null
          }
        ])
        .select()
        .single();

      if (carError) {
        console.error("新增車輛失敗:", carError);
        alert("新增車輛失敗，請看 Console");
        return;
      }

      savedCar = insertedCar;

      const imageRows = images.map((img, index) => ({
       car_id: insertedCar.id,
        image_url: img,
        sort_order: index
      }));

      const { error: imagesError } = await supabase
        .from("car_images")
        .insert(imageRows);

      if (imagesError) {
        console.error("新增圖片失敗:", imagesError);
        alert("車輛已新增，但圖片新增失敗，請看 Console");
        return;
      }

      alert("刊登成功！回首頁就能看到新車。");
    }

    document.getElementById("titleInput").value = "";
    document.getElementById("brandInput").value = "";
    document.getElementById("modelInput").value = "";
    document.getElementById("yearInput").value = "";
    document.getElementById("ccInput").value = "";
    document.getElementById("priceInput").value = "";
    document.getElementById("regionInput").value = "";
    document.getElementById("categoryInput").value = "";
    document.getElementById("mileageInput").value = "";
    document.getElementById("colorInput").value = "";
    document.getElementById("imageInput").value = "";
    selectedImageFiles = [];
    renderImagePreview();
    document.getElementById("equipmentInput").value = "";
    document.getElementById("descInput").value = "";

    //window.location.href = "index.html";

    editingCarId = null;
    oldImages = [];

    addCarBtn.textContent = "送出";
    cancelEditBtn.classList.add("hidden");
    editModeText.classList.add("hidden");

    loadAdminCars();
  });
}

// =========================
// ADMIN 車輛列表 + 刪除
// =========================
const adminCarList = document.getElementById("adminCarList");
const adminSearchInput = document.getElementById("adminSearchInput");

let adminCars = [];

const isSellerDashboard = window.location.pathname.includes("seller-dashboard.html");
let currentSellerStore = null;

async function loadAdminCars() {
  if (!adminCarList) return;

  adminCarList.innerHTML = "<p>車輛讀取中...</p>";

  let query = supabase
    .from("cars")
    .select("*")
    .order("admin_no", { ascending: true });

  if (isSellerDashboard) {
    currentSellerStore = await getMyStore();

    if (!currentSellerStore) {
      adminCarList.innerHTML = "<p>找不到你的車行資料，請確認你是車行帳號。</p>";
      return;
    }

    query = query.eq("store_id", currentSellerStore.id);
  }

  const { data, error } = await query;

  if (error) {
    console.error("讀取後台車輛失敗:", error);
    adminCarList.innerHTML = "<p>讀取車輛失敗，請看 Console。</p>";
    return;
  }

  adminCars = data || [];
  renderAdminCars(adminCars);
}

function renderAdminCars(list) {
  if (!adminCarList) return;

  if (!list || list.length === 0) {
    adminCarList.innerHTML = "<p>找不到符合的車輛。</p>";
    return;
  }

  adminCarList.innerHTML = "";

  list.forEach((car) => {
    const item = document.createElement("div");
    item.className = "admin-car-item";

    item.innerHTML = `
      <img src="${car.image}" alt="${car.title}" class="admin-car-img">

      <div class="admin-car-info">
        <h3>#${car.admin_no || "未編號"}｜${car.title}</h3>
        <p>NT$ ${Number(car.price).toLocaleString()}</p>
        <p>${car.brand || ""} ${car.model || ""}｜${car.category || ""}｜${car.region || ""}</p>
      </div>

      <div class="admin-action-row">
        <button class="admin-edit-btn" data-id="${car.id}">
          編輯
        </button>

        <button class="admin-delete-btn" data-id="${car.id}">
          刪除
        </button>
      </div>
    `;

    adminCarList.appendChild(item);
  });

  document.querySelectorAll(".admin-edit-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const carId = Number(btn.dataset.id);
      await startEditCar(carId);
    });
  });

  document.querySelectorAll(".admin-delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const carId = btn.dataset.id;

      const confirmDelete = confirm("確定要刪除這台車嗎？刪除後無法復原。");
      if (!confirmDelete) return;

      await deleteCar(carId);
    });
  });
}

if (adminSearchInput) {
  adminSearchInput.addEventListener("input", () => {
    const keyword = adminSearchInput.value.trim().toLowerCase();

    const filtered = adminCars.filter((car) => {
      return (
        String(car.admin_no || "").includes(keyword) ||
        String(car.title || "").toLowerCase().includes(keyword) ||
        String(car.brand || "").toLowerCase().includes(keyword) ||
        String(car.model || "").toLowerCase().includes(keyword) ||
        String(car.region || "").toLowerCase().includes(keyword) ||
        String(car.category || "").toLowerCase().includes(keyword)
      );
    });

    renderAdminCars(filtered);
  });
}

async function startEditCar(carId) {
  const car = adminCars.find(item => Number(item.id) === Number(carId));

  if (!car) {
    alert("找不到這台車");
    return;
  }

  const { data: imageData, error: imageError } = await supabase
    .from("car_images")
    .select("*")
    .eq("car_id", car.id)
    .order("sort_order", { ascending: true });

  if (imageError) {
    console.error("讀取圖片失敗:", imageError);
    alert("讀取圖片失敗，請看 Console");
    return;
  }

  oldImages =
    imageData && imageData.length > 0
      ? imageData.map(item => item.image_url)
      : [car.image];

  editingCarId = car.id;

  document.getElementById("titleInput").value = car.title || "";
  document.getElementById("brandInput").value = car.brand || "";
  document.getElementById("modelInput").value = car.model || "";
  document.getElementById("yearInput").value = car.year || "";
  document.getElementById("ccInput").value = car.cc || "";
  document.getElementById("priceInput").value = car.price || "";
  document.getElementById("regionInput").value = car.region || "";
  document.getElementById("categoryInput").value = car.category || "";
  document.getElementById("mileageInput").value = car.mileage || "";
  document.getElementById("colorInput").value = car.color || "";
  document.getElementById("equipmentInput").value = car.equipment || "";
  document.getElementById("descInput").value = car.description || "";
  document.getElementById("imageInput").value = "";
  selectedImageFiles = [];
  renderImagePreview();

  addCarBtn.textContent = "儲存修改";
  cancelEditBtn.classList.remove("hidden");
  editModeText.classList.remove("hidden");
  editModeText.textContent = `目前正在編輯：#${car.admin_no || "未編號"}｜${car.title}`;

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

async function deleteCar(carId) {
  const { error: imageError } = await supabase
    .from("car_images")
    .delete()
    .eq("car_id", carId);

  if (imageError) {
    console.error("刪除圖片失敗:", imageError);
    alert("刪除圖片失敗，請看 Console");
    return;
  }

  const { error: favoriteError } = await supabase
    .from("favorites")
    .delete()
    .eq("car_id", String(carId));

  if (favoriteError) {
    console.error("刪除收藏紀錄失敗:", favoriteError);
    alert("刪除收藏紀錄失敗，請看 Console");
    return;
  }

  let deleteQuery = supabase
    .from("cars")
    .delete()
    .eq("id", carId);

  if (isSellerDashboard && currentSellerStore) {
    deleteQuery = deleteQuery.eq("store_id", currentSellerStore.id);
  }

  const { error: carError } = await deleteQuery;

  if (carError) {
    console.error("刪除車輛失敗:", carError);
    alert("刪除車輛失敗，請看 Console");
    return;
  }

  alert("車輛已刪除");
  loadAdminCars();
}

if (cancelEditBtn) {
  cancelEditBtn.addEventListener("click", () => {
    editingCarId = null;
    oldImages = [];

    document.getElementById("titleInput").value = "";
    document.getElementById("brandInput").value = "";
    document.getElementById("modelInput").value = "";
    document.getElementById("yearInput").value = "";
    document.getElementById("ccInput").value = "";
    document.getElementById("priceInput").value = "";
    document.getElementById("regionInput").value = "";
    document.getElementById("categoryInput").value = "";
    document.getElementById("mileageInput").value = "";
    document.getElementById("colorInput").value = "";
    document.getElementById("imageInput").value = "";
    selectedImageFiles = [];
    renderImagePreview();
    document.getElementById("equipmentInput").value = "";
    document.getElementById("descInput").value = "";

    addCarBtn.textContent = "送出";
    cancelEditBtn.classList.add("hidden");
    editModeText.classList.add("hidden");
  });
}

async function getMyStore() {
  const user = await getCurrentUser();

  if (!user) {
    alert("請先登入");
    window.location.href = "login.html";
    return null;
  }

  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("讀取車行資料失敗:", error);
    return null;
  }

  return data;
}

loadAdminCars();

// =========================
// 詳細頁功能
// =========================
const carDetail = document.getElementById("carDetail");

if (carDetail) {
  const params = new URLSearchParams(window.location.search);
  const carId = Number(params.get("id"));

  loadCarsFromSupabase()
    .then(async (data) => {
      cars = data;

      const car = cars.find(item => item.id === carId);

      if (!car) {
        carDetail.innerHTML = `
          <div class="detail-content">
            <h2 class="detail-title">找不到這台車</h2>
            <div class="detail-desc">可能已被刪除，或連結有誤。</div>
          </div>
        `;
        hidePageLoader();
        return;
      }

      await recordRecentView(car.id);

      let store = null;

      if (car.store_id) {
        const { data: storeData, error: storeError } = await supabase
          .from("stores")
          .select("*")
          .eq("id", car.store_id)
          .maybeSingle();

        if (storeError) {
          console.error("讀取車行資料失敗:", storeError);
        } else {
          store = storeData;
        }

        if (store?.status === "suspended") {
          carDetail.innerHTML = `
            <div class="detail-content">
              <h2 class="detail-title">此車輛暫停顯示</h2>
              <div class="detail-desc">此車行目前已被平台暫停服務。</div>
            </div>
          `;
          hidePageLoader();
          return;
        }
      }

      const { data: imageData, error: imageError } = await supabase
        .from("car_images")
        .select("*")
        .eq("car_id", car.id)
        .order("sort_order", { ascending: true });

      if (imageError) {
        console.error("讀取 car_images 失敗:", imageError);
      }

      const galleryImages =
        imageData && imageData.length > 0
          ? imageData.map(item => item.image_url)
          : [car.image];

      let currentIndex = 0;
      const equipmentList = car.equipment
        ? car.equipment
            .split("\n")
            .map(item => item.trim())
            .filter(item => item !== "")
        : [];

      carDetail.innerHTML = `
      <div class="detail-container">

        <!-- 左 -->
        <div class="detail-left">
          <div class="detail-image-wrapper carousel">
            <button class="arrow left" id="prevBtn">❮</button>
            <img id="mainImage" src="${galleryImages[0]}" class="detail-main-img">
            <button class="arrow right" id="nextBtn">❯</button>
          </div>

          <div class="thumbnail-row" id="thumbnails">
            ${galleryImages.map((img, index) => `
              <img 
                src="${img}" 
                class="thumb ${index === 0 ? "active" : ""}" 
                data-index="${index}"
              >
            `).join("")}
          </div>
        </div>

        <!-- 右 -->
        <div class="detail-right">

          <h2 class="car-title">${car.title}</h2>

          <div class="car-spec-grid">

            <div class="spec-item">
              <div class="spec-label">廠牌</div>
              <div class="spec-value">${car.brand || "-"}</div>
            </div>

            <div class="spec-item">
              <div class="spec-label">車型</div>
              <div class="spec-value">${car.model || "-"}</div>
            </div>

            <div class="spec-item">
              <div class="spec-label">類型</div>
              <div class="spec-value">${car.category || "-"}</div>
            </div>

            <div class="spec-item">
              <div class="spec-label">排氣量</div>
              <div class="spec-value">${car.cc || "-"} cc</div>
            </div>

            <div class="spec-item">
              <div class="spec-label">顏色</div>
              <div class="spec-value">${car.color || "-"}</div>
            </div>

            <div class="spec-item">
              <div class="spec-label">出廠年份</div>
              <div class="spec-value">${car.year ? `${car.year} 年` : "-"}</div>
            </div>

            <div class="spec-item spec-item-full">
              <div class="spec-label">行駛里程</div>
              <div class="spec-value">
                ${car.mileage ? Number(car.mileage).toLocaleString() + " 公里" : "-"}
              </div>
            </div>

          </div>

          <div class="car-price-row">
            <span class="price-title">售價</span>
            <span class="car-price">${Number(car.price).toLocaleString()}</span>
          </div>

          ${store ? `
            <div class="detail-store-box">
              <div class="detail-store-label">販售車行</div>

              <div class="detail-store-name">
                ${store.name}
              </div>

              <p class="detail-store-desc">
                ${store.description || "優質車行，嚴選好車。"}
              </p>

              <a 
                href="store.html?slug=${store.slug}" 
                class="detail-store-link"
              >
                查看車行店面
              </a>
            </div>
          ` : ""}

          <div class="detail-action-row">
            <button id="detailFavoriteBtn" class="favorite-btn detail-favorite" type="button" data-id="${car.id}">🤍 收藏</button>
            <button id="detailCompareBtn" class="contact-btn detail-compare-btn" type="button" data-id="${car.id}">加入比較</button>
            <button id="contactSellerBtn" class="contact-btn">聯絡賣家</button>
            <button id="appointmentBtn" class="contact-btn">預約看車</button>
          </div>

         <div class="contact-menu hidden" id="contactQuestionMenu">
          <div class="contact-menu-card">
            <div class="contact-menu-head">
              <h3>想詢問賣家什麼？</h3>
              <button id="closeContactMenu" type="button">×</button>
            </div>

            <button class="quick-question-btn" data-message="請問這台車車況如何？有沒有事故或泡水紀錄？">車況問題</button>
            <button class="quick-question-btn" data-message="請問這台車價格還有空間可以談嗎？">價格可談嗎</button>
            <button class="quick-question-btn" data-message="請問這台車可以預約試車嗎？">是否可以試車</button>
            <button class="quick-question-btn" data-message="請問這台車可以協助辦理貸款嗎？">是否可以貸款</button>
            <button class="quick-question-btn custom-question" data-custom="true">輸入訊息</button>
          </div>
        </div>

        </div>
      </div>
      ${equipmentList.length > 0 ? `
        <div class="equipment-section">
          <div class="equipment-header">
            <span class="equipment-deco"></span>
            <h3>車輛配備</h3>
          </div>

          <div class="equipment-content">
            <div class="equipment-label">重點配備</div>
            <div class="equipment-list">
              ${equipmentList.map(item => `<div class="equipment-item">${item}</div>`).join("")}
            </div>
          </div>
        </div>
      ` : ""}
      `;

      const mainImage = document.getElementById("mainImage");
      const prevBtn = document.getElementById("prevBtn");
      const nextBtn = document.getElementById("nextBtn");
      const thumbs = document.querySelectorAll(".thumb");

      function updateImage() {
        mainImage.src = galleryImages[currentIndex];

        thumbs.forEach(thumb => thumb.classList.remove("active"));
        thumbs[currentIndex].classList.add("active");
      }

      if (prevBtn) {
        prevBtn.addEventListener("click", () => {
          currentIndex = (currentIndex - 1 + galleryImages.length) % galleryImages.length;
          updateImage();
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener("click", () => {
          currentIndex = (currentIndex + 1) % galleryImages.length;
          updateImage();
        });
      }

      thumbs.forEach(thumb => {
        thumb.addEventListener("click", () => {
          currentIndex = Number(thumb.dataset.index);
          updateImage();
        });
      });

      const contactSellerBtn = document.getElementById("contactSellerBtn");
      const contactQuestionMenu = document.getElementById("contactQuestionMenu");
      const closeContactMenu = document.getElementById("closeContactMenu");
      const quickQuestionBtns = document.querySelectorAll(".quick-question-btn");
      const appointmentBtn = document.getElementById("appointmentBtn");

      const detailFavoriteBtn = document.getElementById("detailFavoriteBtn");
      const detailCompareBtn = document.getElementById("detailCompareBtn");

      if (detailFavoriteBtn) {
        const favoriteIds = await getFavoriteCarIds();
        const isActive = favoriteIds.includes(normalizeCarId(car.id));
        setFavoriteButtonState(detailFavoriteBtn, isActive);

        detailFavoriteBtn.addEventListener("click", () => {
          toggleFavorite(car.id, detailFavoriteBtn);
        });
      }

      if (detailCompareBtn) {
        const updateDetailCompareBtn = () => {
          const ids = getCompareIds();
          const isActive = ids.includes(String(car.id));
          detailCompareBtn.textContent = isActive ? "已加入比較" : "加入比較";
          detailCompareBtn.classList.toggle("active", isActive);
        };

        updateDetailCompareBtn();

        detailCompareBtn.addEventListener("click", () => {
          let ids = getCompareIds();
          const id = String(car.id);

          if (ids.includes(id)) {
            ids = ids.filter((item) => item !== id);
          } else {
            if (ids.length >= 3) {
              alert("最多只能比較 3 台車。");
              return;
            }

            ids.push(id);
          }

          saveCompareIds(ids);
          updateDetailCompareBtn();
          renderCompareBar();
        });
      }

      if (contactSellerBtn && contactQuestionMenu) {
        contactSellerBtn.addEventListener("click", () => {
          contactQuestionMenu.classList.remove("hidden");
        });
      }

      if (closeContactMenu && contactQuestionMenu) {
        closeContactMenu.addEventListener("click", () => {
          contactQuestionMenu.classList.add("hidden");
        });
      }

      quickQuestionBtns.forEach((btn) => {
        btn.addEventListener("click", async () => {
          let message = btn.dataset.message || "";

          if (btn.dataset.custom === "true") {
            message = prompt("請輸入想詢問賣家的內容：", `您好，我想詢問 ${car.title}`);
          }

          if (!message || !message.trim()) return;

          contactQuestionMenu.classList.add("hidden");
          await startCarChat(car, message.trim());
        });
      });

      if (appointmentBtn) {
        appointmentBtn.addEventListener("click", async () => {
          await startCarChat(
            car,
            "請問這台車還在嗎？我想預約看車。"
          );
        });
      }

      hidePageLoader();
    })
    .catch((error) => {
      console.error("詳細頁載入失敗:", error);
      hidePageLoader();
    });
}

const navLinks = document.querySelectorAll(".nav-link");
const sections = document.querySelectorAll("#homeSection, #carSection, #serviceSection, #aboutSection");

function setActiveNav() {
  let currentSectionId = "homeSection"; // ⭐ 預設首頁

  const scrollY = window.scrollY;
  const offset = 120;

  sections.forEach(section => {
    const sectionTop = section.offsetTop - offset;
    const sectionHeight = section.offsetHeight;

    if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
      currentSectionId = section.getAttribute("id");
    }
  });

  navLinks.forEach(link => {
    link.classList.remove("active");

    const href = link.getAttribute("href");
    if (href === `#${currentSectionId}`) {
      link.classList.add("active");
    }
  });
}

window.addEventListener("scroll", setActiveNav);
window.addEventListener("load", setActiveNav);

function renderPagination(totalCars) {
  let pagination = document.getElementById("pagination");

  if (!pagination) {
    pagination = document.createElement("div");
    pagination.id = "pagination";
    pagination.style.textAlign = "center";
    pagination.style.margin = "30px 0";
    carList.after(pagination);
  }

  const totalPages = Math.ceil(totalCars / carsPerPage);

  pagination.innerHTML = `
    <button id="prevPage" ${currentPage === 1 ? "disabled" : ""}>上一頁</button>
    <span style="margin: 0 10px;">第 ${currentPage} / ${totalPages} 頁</span>
    <button id="nextPage" ${currentPage === totalPages ? "disabled" : ""}>下一頁</button>
  `;

  document.getElementById("prevPage")?.addEventListener("click", () => {
    currentPage--;
    renderCars(filteredCars);
  });

  document.getElementById("nextPage")?.addEventListener("click", () => {
    currentPage++;
    renderCars(filteredCars);
  });
}

const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const mobileDrawer = document.getElementById("mobileDrawer");

if (mobileMenuBtn && mobileDrawer) {
  mobileMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    mobileDrawer.classList.toggle("show");
  });

  document.addEventListener("click", (e) => {
    if (!mobileDrawer.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
      mobileDrawer.classList.remove("show");
    }
  });

  mobileDrawer.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      mobileDrawer.classList.remove("show");
    });
  });
}

async function updateAuthUI() {
  const memberCenterBtn = document.getElementById("memberCenterBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const mobileMemberCenterBtn = document.getElementById("mobileMemberCenterBtn");
  const logoutBtnMobile = document.getElementById("logoutBtnMobile");

  const guestOnlyEls = document.querySelectorAll(".guest-only");
  const userOnlyEls = document.querySelectorAll(".user-only");

  if (!memberCenterBtn || !logoutBtn) return;

  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) {
    console.error("取得登入狀態失敗：", error);
    return;
  }

  if (user) {
    guestOnlyEls.forEach((el) => el.classList.add("hidden"));
    userOnlyEls.forEach((el) => el.classList.remove("hidden"));

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("讀取會員角色失敗：", profileError);
    }

    if (profile?.role === "seller") {
      memberCenterBtn.textContent = "車行後台";
      memberCenterBtn.href = "seller-dashboard.html";

      if (mobileMemberCenterBtn) {
        mobileMemberCenterBtn.textContent = "車行後台";
        mobileMemberCenterBtn.href = "seller-dashboard.html";
      }
    } else if (profile?.role === "admin") {
      memberCenterBtn.textContent = "管理後台";
      memberCenterBtn.href = "admin.html";

      if (mobileMemberCenterBtn) {
        mobileMemberCenterBtn.textContent = "管理後台";
        mobileMemberCenterBtn.href = "admin.html";
      }
    } else {
      memberCenterBtn.textContent = "會員中心";
      memberCenterBtn.href = "member.html";

      if (mobileMemberCenterBtn) {
        mobileMemberCenterBtn.textContent = "會員中心";
        mobileMemberCenterBtn.href = "member.html";
      }
    }
  } else {
    guestOnlyEls.forEach((el) => el.classList.remove("hidden"));
    userOnlyEls.forEach((el) => el.classList.add("hidden"));
  }

  async function handleLogout() {
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      console.error("登出失敗：", signOutError);
      alert("登出失敗，請稍後再試");
      return;
    }

    window.location.href = "index.html";
  }

  logoutBtn.addEventListener("click", handleLogout);

  if (logoutBtnMobile) {
    logoutBtnMobile.addEventListener("click", handleLogout);
  }
}

updateAuthUI();

// 如果在 member.html，沒登入就踢回 login
if (window.location.pathname.includes("member.html")) {
  supabase.auth.getUser().then(({ data }) => {
    if (!data.user) {
      alert("請先登入");
      window.location.href = "login.html";
    }
  });
}

const tabs = document.querySelectorAll(".member-sidebar li");
const tabContents = {
  profile: document.getElementById("profileTab"),
  favorites: document.getElementById("favoritesTab"),
  recent: document.getElementById("recentTab"),
  followedStores: document.getElementById("followedStoresTab"),
  chat: document.getElementById("chatTab"),
  notifications: document.getElementById("notificationsTab")
};
const buyerChatList = document.getElementById("buyerChatList");
const buyerChatBadge = document.getElementById("buyerChatBadge");
const buyerChatBell = document.getElementById("buyerChatBell");
const buyerChatBellBadge = document.getElementById("buyerChatBellBadge");
const buyerBellDropdown = document.getElementById("buyerBellDropdown");
const buyerNotificationList = document.getElementById("buyerNotificationList");
const recentViewList = document.getElementById("recentViewList");
const followedStoreList = document.getElementById("followedStoreList");
const buyerChatRoom = document.getElementById("buyerChatRoom");
let currentBuyerChatThreadId = null;
let buyerChatThreads = [];
let buyerChatChannel = null;
let buyerBellChannel = null;
let renderedBuyerMessageIds = new Set();

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");

    Object.values(tabContents).forEach(c => c.classList.remove("active"));
    tabContents[tab.dataset.tab].classList.add("active");

    if (tab.dataset.tab === "recent") {
      loadRecentViews();
    }

    if (tab.dataset.tab === "chat") {
      loadBuyerChats();
    }

    if (tab.dataset.tab === "notifications") {
      loadBuyerNotifications();
    }

    if (tab.dataset.tab === "followedStores") {
      loadFollowedStores();
    }
  });
});

async function openMemberTabFromUrl() {
  if (!window.location.pathname.includes("member.html")) return;

  const params = new URLSearchParams(window.location.search);
  const tabName = params.get("tab");
  const threadId = params.get("thread");

  if (!tabName) return;

  const targetTab = document.querySelector(`.member-sidebar li[data-tab="${tabName}"]`);

  if (!targetTab || !tabContents[tabName]) return;

  tabs.forEach(t => t.classList.remove("active"));
  targetTab.classList.add("active");

  Object.values(tabContents).forEach(c => c.classList.remove("active"));
  tabContents[tabName].classList.add("active");

  if (tabName === "chat") {
    await loadBuyerChats();

    if (threadId) {
      await openBuyerChatRoom(threadId);
    }
  }

  if (tabName === "recent") {
    await loadRecentViews();
  }

  if (tabName === "followedStores") {
    await loadFollowedStores();
  }

  if (tabName === "notifications") {
    await loadBuyerNotifications();
  }
}

async function loadMemberProfile() {
  if (!window.location.pathname.includes("member.html")) return;

  const nameEl = document.getElementById("userName");
  const emailEl = document.getElementById("userEmail");
  const phoneEl = document.getElementById("userPhone");

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("取得會員失敗:", userError);
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name, email, phone")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("讀取 profiles 失敗:", profileError);

    if (nameEl) {
      nameEl.textContent = `姓名：${user.user_metadata?.display_name || "未設定"}`;
    }
    if (emailEl) {
      emailEl.textContent = `Email：${user.email || "未設定"}`;
    }
    if (phoneEl) {
      phoneEl.textContent = `手機：${user.phone || "未設定"}`;
    }
    return;
  }

  if (nameEl) {
    nameEl.textContent = `姓名：${profile.display_name || "未設定"}`;
  }
  if (emailEl) {
    emailEl.textContent = `Email：${profile.email || user.email || "未設定"}`;
  }
  if (phoneEl) {
    phoneEl.textContent = `手機：${profile.phone || user.phone || "未設定"}`;
  }
}

loadMemberProfile();

async function recordRecentView(carId) {
  const user = await getCurrentUser();
  if (!user || !carId) return;

  const { error } = await supabase
    .from("recent_views")
    .upsert(
      {
        user_id: user.id,
        car_id: Number(carId),
        viewed_at: new Date().toISOString()
      },
      {
        onConflict: "user_id,car_id"
      }
    );

  if (error) {
    console.error("記錄最近瀏覽失敗:", error);
  }
}

async function loadFavoriteCars() {
  if (!window.location.pathname.includes("member.html")) return;

  const favoriteList = document.getElementById("favoriteList");

  if (!favoriteList) return;

  const user = await getCurrentUser();

  if (!user) {
    favoriteList.innerHTML = `<p>請先登入會員。</p>`;
    return;
  }

  const { data: favoriteRows, error: favoriteError } = await supabase
    .from("favorites")
    .select("car_id")
    .eq("user_id", user.id);

  if (favoriteError) {
    console.error("讀取收藏資料失敗:", favoriteError);
    favoriteList.innerHTML = `<p>讀取收藏失敗，請稍後再試。</p>`;
    return;
  }

  if (!favoriteRows || favoriteRows.length === 0) {
    favoriteList.innerHTML = `<p>目前還沒有收藏任何車輛。</p>`;
    return;
  }

  const favoriteIds = favoriteRows.map(item => item.car_id);

  const { data: carData, error: carError } = await supabase
    .from("cars")
    .select("*")
    .in("id", favoriteIds)
    .order("created_at", { ascending: false });

  if (carError) {
    console.error("讀取收藏車輛失敗:", carError);
    favoriteList.innerHTML = `<p>讀取收藏車輛失敗，請稍後再試。</p>`;
    return;
  }

  if (!carData || carData.length === 0) {
    favoriteList.innerHTML = `<p>目前還沒有收藏任何車輛。</p>`;
    return;
  }

  favoriteList.innerHTML = "";

  carData.forEach(car => {
    const card = document.createElement("div");
    card.className = "car-card";

    card.innerHTML = `
      <button class="favorite-btn active" data-id="${car.id}" type="button">❤️</button>
      <button class="compare-btn" data-id="${car.id}" type="button">⇄</button>

      <a href="detail.html?id=${car.id}" class="car-link">
        <img src="${car.image}" alt="${car.title}">
        ${car.is_featured ? `<div class="featured-badge">精選</div>` : ""}
        <div class="car-content">
          <h2 class="car-title">${car.title}</h2>
          <div class="card-price">NT$ ${Number(car.price).toLocaleString()}</div>
          <div class="car-meta">
            ${car.category || "-"}｜${car.region || "-"}｜${car.year ? car.year + " 年" : "-"}
          </div>
        </div>
      </a>
    `;

    favoriteList.appendChild(card);
  });

  const favoriteButtons = favoriteList.querySelectorAll(".favorite-btn");

  favoriteButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleFavorite(btn.dataset.id, btn);
    });
  });

  setupCompareButtons();
  renderCompareBar();
}

function renderRecentViewCars(carArray) {
  if (!recentViewList) return;

  recentViewList.innerHTML = "";

  carArray.forEach((car) => {
    const card = document.createElement("div");
    card.className = "car-card";

    card.innerHTML = `
      <button class="favorite-btn" data-id="${car.id}" type="button">🤍</button>
      <button class="compare-btn" data-id="${car.id}" type="button">⇄</button>
      <a href="detail.html?id=${car.id}" class="car-link">
        <img src="${car.image}" alt="${car.title}">
        ${car.is_featured ? `<div class="featured-badge">精選</div>` : ""}
        <div class="car-content">
          <h2 class="car-title">${car.title}</h2>
          <div class="card-price">NT$ ${Number(car.price).toLocaleString()}</div>
          <div class="car-meta">
            ${car.category || "-"}｜${car.region || "-"}｜${car.year ? car.year + " 年" : "-"}
          </div>
        </div>
      </a>
    `;

    recentViewList.appendChild(card);
  });

  recentViewList.querySelectorAll(".favorite-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleFavorite(btn.dataset.id, btn);
    });
  });

  setupCompareButtons();
  renderCompareBar();
}

async function loadRecentViews() {
  if (!recentViewList) return;

  const user = await getCurrentUser();

  if (!user) {
    recentViewList.innerHTML = "<p>請先登入會員。</p>";
    return;
  }

  recentViewList.innerHTML = "<p>最近瀏覽讀取中...</p>";

  const { data, error } = await supabase
    .from("recent_views")
    .select(`
      viewed_at,
      cars (*)
    `)
    .eq("user_id", user.id)
    .order("viewed_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("讀取最近瀏覽失敗:", error);
    recentViewList.innerHTML = "<p>讀取最近瀏覽失敗。</p>";
    return;
  }

  const recentCars = (data || [])
    .map((item) => item.cars)
    .filter(Boolean);

  if (!recentCars.length) {
    recentViewList.innerHTML = "<p>目前沒有最近瀏覽紀錄。</p>";
    return;
  }

  renderRecentViewCars(recentCars);
}

async function loadFollowedStores() {
  if (!followedStoreList) return;

  const user = await getCurrentUser();

  if (!user) {
    followedStoreList.innerHTML = "<p>請先登入會員。</p>";
    return;
  }

  followedStoreList.innerHTML = "<p>追蹤車行讀取中...</p>";

  const { data, error } = await supabase
    .from("store_followers")
    .select(`
      id,
      created_at,
      stores (
        id,
        name,
        slug,
        description,
        logo_url
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("讀取追蹤車行失敗:", error);
    followedStoreList.innerHTML = "<p>讀取追蹤車行失敗。</p>";
    return;
  }

  if (!data || data.length === 0) {
    followedStoreList.innerHTML = "<p>目前尚未追蹤任何車行。</p>";
    return;
  }

  followedStoreList.innerHTML = "";

  data.forEach((item) => {
    const store = item.stores;
    if (!store) return;

    const card = document.createElement("div");
    card.className = "followed-store-card";

    card.innerHTML = `
      <div class="followed-store-logo">
        ${
          store.logo_url
            ? `<img src="${store.logo_url}" alt="${store.name}">`
            : `<span>${store.name?.slice(0, 1) || "車"}</span>`
        }
      </div>

      <div class="followed-store-info">
        <h3>${store.name}</h3>
        <p>${store.description || "尚未填寫車行介紹"}</p>
        <a href="store.html?store=${store.slug}">查看車行</a>
      </div>
    `;

    followedStoreList.appendChild(card);
  });
}

async function loadBuyerChats() {
  if (!window.location.pathname.includes("member.html")) return;
  if (!buyerChatList) return;

  const user = await getCurrentUser();

  if (!user) {
    buyerChatList.innerHTML = "<p>請先登入會員。</p>";
    return;
  }

  buyerChatList.innerHTML = "<p>聊天讀取中...</p>";

  const { data, error } = await supabase
    .from("chat_threads")
    .select(`
      *,
      cars (
        id,
        title,
        image,
        price
      ),
      stores (
        name
      )
    `)
    .eq("buyer_id", user.id)
    .order("last_message_at", { ascending: false });

  if (error) {
    console.error("讀取買家聊天失敗:", error);
    buyerChatList.innerHTML = "<p>讀取聊天失敗。</p>";
    return;
  }

  buyerChatThreads = data || [];
  renderBuyerChats(data || []);
}

function renderBuyerChats(threads) {
  if (!buyerChatList) return;

  if (!threads.length) {
    buyerChatList.innerHTML = "<p class='chat-empty-list'>目前沒有聊天訊息。</p>";
    return;
  }

  buyerChatList.innerHTML = "";

  threads.forEach((thread) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className =
      Number(thread.id) === Number(currentBuyerChatThreadId)
        ? "seller-chat-card active"
        : "seller-chat-card";

    const displayName = thread.stores?.name || "車行";
    const avatarText = displayName.slice(0, 1);

    card.innerHTML = `
      <div class="chat-avatar-wrap">
        <div class="chat-avatar empty">${avatarText}</div>
      </div>

      <div class="chat-row-main">
        <div class="chat-row-head">
          <strong>${displayName}</strong>
          <span>${thread.last_message_at ? new Date(thread.last_message_at).toLocaleTimeString("zh-TW", {
            hour: "2-digit",
            minute: "2-digit"
          }) : ""}</span>
        </div>

        <p>${thread.last_message || "尚無訊息"}</p>
      </div>
    `;

    card.addEventListener("click", async () => {
      document.querySelectorAll(".buyer-chat-list .seller-chat-card").forEach((item) => {
        item.classList.remove("active");
      });

      card.classList.add("active");
      await openBuyerChatRoom(thread.id);
    });

    buyerChatList.appendChild(card);
  });
}

async function updateBuyerChatBadge() {
  if (!buyerChatBadge) return;

  const user = await getCurrentUser();
  if (!user) return;

  const { data: threads } = await supabase
    .from("chat_threads")
    .select("id")
    .eq("buyer_id", user.id);

  const threadIds = (threads || []).map((t) => t.id);

  let chatCount = 0;

  if (threadIds.length) {
    const { data: messages } = await supabase
      .from("chat_messages")
      .select("id")
      .in("thread_id", threadIds)
      .eq("sender_role", "seller")
      .is("read_at", null);

    chatCount = messages?.length || 0;
  }

  const { data: buyerNotifications } = await supabase
    .from("notifications")
    .select("id")
    .eq("buyer_id", user.id)
    .eq("is_read", false);

  const systemCount = buyerNotifications?.length || 0;
  const count = chatCount + systemCount;

  buyerChatBadge.textContent = chatCount;
  buyerChatBadge.classList.toggle("hidden", chatCount === 0);

  if (buyerChatBellBadge) {
    buyerChatBellBadge.textContent = count;
    buyerChatBellBadge.classList.toggle("hidden", count === 0);
  }
}

async function loadBuyerNotifications() {
  if (!buyerNotificationList) return;

  const user = await getCurrentUser();
  if (!user) {
    buyerNotificationList.innerHTML = "<p>請先登入。</p>";
    return;
  }

  buyerNotificationList.innerHTML = "<p>通知讀取中...</p>";

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("讀取買家通知失敗:", error);
    buyerNotificationList.innerHTML = "<p>通知讀取失敗。</p>";
    return;
  }

  renderBuyerNotifications(data || []);
}

function renderBuyerNotifications(notifications) {
  if (!buyerNotificationList) return;

  if (!notifications.length) {
    buyerNotificationList.innerHTML = "<p>目前沒有通知。</p>";
    return;
  }

  buyerNotificationList.innerHTML = "";

  notifications.forEach((item) => {
    const card = document.createElement("div");
    card.className = `notification-card ${item.is_read ? "" : "unread"}`;

    card.innerHTML = `
      <strong>${item.title}</strong>
      <p>${item.message || ""}</p>
      <small>${new Date(item.created_at).toLocaleString("zh-TW")}</small>

      ${
        item.is_read
          ? ""
          : `<button class="mark-buyer-notification-read-btn" data-id="${item.id}">
              標記已讀
            </button>`
      }
    `;

    buyerNotificationList.appendChild(card);
  });

  document.querySelectorAll(".mark-buyer-notification-read-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await markBuyerNotificationRead(btn.dataset.id);
    });
  });
}

async function markBuyerNotificationRead(notificationId) {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);

  if (error) {
    console.error("標記買家通知已讀失敗:", error);
    alert("標記已讀失敗");
    return;
  }

  await loadBuyerNotifications();
  await updateBuyerChatBadge();
}

async function loadBuyerBellDropdown() {
  if (!buyerBellDropdown) return;

  const user = await getCurrentUser();
  if (!user) return;

  const { data: threads } = await supabase
    .from("chat_threads")
    .select(`
      id,
      last_message,
      last_message_at,
      cars (title),
      stores (name)
    `)
    .eq("buyer_id", user.id)
    .order("last_message_at", { ascending: false })
    .limit(10);

  const threadIds = (threads || []).map((t) => t.id);

  let unreadThreads = [];

  if (threadIds.length) {
    const { data: unreadMessages } = await supabase
      .from("chat_messages")
      .select("thread_id")
      .in("thread_id", threadIds)
      .eq("sender_role", "seller")
      .is("read_at", null);

    const unreadThreadIds = new Set((unreadMessages || []).map((m) => m.thread_id));
    unreadThreads = (threads || []).filter((t) => unreadThreadIds.has(t.id));
  }

  const { data: systemNotifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("buyer_id", user.id)
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(10);

  const chatHtml = unreadThreads.map((thread) => `
    <button class="bell-message-item" data-type="chat" data-thread-id="${thread.id}">
      <strong>聊天訊息｜${thread.cars?.title || "未知車輛"}</strong>
      <span>${thread.stores?.name || "未知車行"}：${thread.last_message || "新訊息"}</span>
      <small>${new Date(thread.last_message_at).toLocaleString("zh-TW")}</small>
    </button>
  `).join("");

  const notificationHtml = (systemNotifications || []).map((item) => `
    <button class="bell-message-item" data-type="notification" data-id="${item.id}">
      <strong>系統通知｜${item.title}</strong>
      <span>${item.message || ""}</span>
      <small>${new Date(item.created_at).toLocaleString("zh-TW")}</small>
    </button>
  `).join("");

  const finalHtml = chatHtml + notificationHtml;

  if (!finalHtml) {
    buyerBellDropdown.innerHTML = `<p class="bell-empty">目前沒有未讀通知</p>`;
    return;
  }

  buyerBellDropdown.innerHTML = finalHtml;

  buyerBellDropdown.querySelectorAll(".bell-message-item").forEach((btn) => {
    btn.addEventListener("click", async () => {
      buyerBellDropdown.classList.add("hidden");

      if (btn.dataset.type === "chat") {
        document.querySelectorAll(".member-sidebar li").forEach((item) => {
          item.classList.remove("active");
        });

        document.querySelector('.member-sidebar li[data-tab="chat"]')?.classList.add("active");

        Object.values(tabContents).forEach((tab) => {
          tab.classList.remove("active");
        });

        tabContents.chat.classList.add("active");

        await loadBuyerChats();
        await openBuyerChatRoom(btn.dataset.threadId);
        return;
      }

      if (btn.dataset.type === "notification") {
        await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("id", btn.dataset.id);

        document.querySelectorAll(".member-sidebar li").forEach((item) => {
          item.classList.remove("active");
        });

        document.querySelector('.member-sidebar li[data-tab="notifications"]')?.classList.add("active");

        Object.values(tabContents).forEach((tab) => {
          tab.classList.remove("active");
        });

        tabContents.notifications.classList.add("active");

        await loadBuyerNotifications();
        await updateBuyerChatBadge();
      }
    });
  });
}

async function subscribeBuyerBellRealtime() {
  if (buyerBellChannel) {
    supabase.removeChannel(buyerBellChannel);
  }

  const user = await getCurrentUser();
  if (!user) return;

  buyerBellChannel = supabase
    .channel(`buyer-bell-${user.id}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chat_messages"
      },
      async () => {
        await updateBuyerChatBadge();

        if (buyerBellDropdown && !buyerBellDropdown.classList.contains("hidden")) {
          await loadBuyerBellDropdown();
        }
      }
    )

    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications"
      },
      async () => {
        await updateBuyerChatBadge();

        if (buyerBellDropdown && !buyerBellDropdown.classList.contains("hidden")) {
          await loadBuyerBellDropdown();
        }
      }
    )

    .subscribe();
}

if (buyerChatBell) {
  buyerChatBell.addEventListener("click", async () => {
    if (!window.location.pathname.includes("member.html")) {
      window.location.href = "member.html?tab=chat";
      return;
    }

    if (!buyerBellDropdown) return;

    buyerBellDropdown.classList.toggle("hidden");

    if (!buyerBellDropdown.classList.contains("hidden")) {
      await loadBuyerBellDropdown();
    }
  });
}

async function openBuyerChatRoom(threadId) {
  if (!buyerChatRoom) return;

  currentBuyerChatThreadId = Number(threadId);
  buyerChatRoom.innerHTML = `
    <p class="chat-loading-text">聊天內容讀取中...</p>
  `;

  await supabase
    .from("chat_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("thread_id", currentBuyerChatThreadId)
    .eq("sender_role", "seller")
    .is("read_at", null);

  await updateBuyerChatBadge();

  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("thread_id", currentBuyerChatThreadId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("讀取聊天內容失敗:", error);
    buyerChatRoom.innerHTML = `
      <p class="chat-loading-text">讀取聊天內容失敗。</p>
    `;
    return;
  }

  const thread = buyerChatThreads.find(
    (t) => Number(t.id) === Number(threadId)
  );

  buyerChatRoom.innerHTML = `
    <div class="chat-room-header">
      <div class="chat-room-user">
        <div class="chat-room-avatar empty">
          ${(thread?.stores?.name || "車行").slice(0, 1)}
        </div>

        <div>
          <strong>${thread?.stores?.name || "車行"}</strong>
          <span>車行回覆中</span>
        </div>
      </div>

      <button id="chatMoreBtn" class="chat-more-btn" type="button">
        <i class="fa-solid fa-bars"></i>
      </button>

      <div id="chatMoreMenu" class="chat-more-menu hidden">
        <button type="button">🚗 查看車輛</button>
        <button type="button">📅 預約看車</button>
        <button type="button" class="danger">🗑 刪除聊天紀錄</button>
      </div>
    </div>

    <div id="buyerChatMessages" class="chat-message-list"></div>

    <div class="chat-input-row">
      <button type="button" class="chat-plus-btn">＋</button>
      <input id="buyerChatInput" placeholder="輸入訊息..." />
      <button id="buyerChatSendBtn" type="button">➤</button>
    </div>
  `;

  renderBuyerChatMessages(data || []);

  document
    .getElementById("buyerChatSendBtn")
    .addEventListener("click", sendBuyerChatMessage);
  
  
  document.getElementById("buyerChatInput").addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      await sendBuyerChatMessage();
    }
  });

  document.getElementById("chatMoreBtn")?.addEventListener("click", () => {
    document.getElementById("chatMoreMenu")?.classList.toggle("hidden");
  });

  subscribeBuyerChatRoom(currentBuyerChatThreadId);
}

function subscribeBuyerChatRoom(threadId) {
  if (buyerChatChannel) {
    supabase.removeChannel(buyerChatChannel);
  }

  buyerChatChannel = supabase
    .channel(`buyer-chat-${threadId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `thread_id=eq.${threadId}`
      },
      async (payload) => {
        const msg = payload.new;

        if (Number(msg.thread_id) !== Number(currentBuyerChatThreadId)) return;

        appendBuyerChatMessage(msg);

        if (msg.sender_role === "seller") {
          await supabase
            .from("chat_messages")
            .update({ read_at: new Date().toISOString() })
            .eq("id", msg.id);
        }

        await updateBuyerChatBadge();
      }
    )
    .subscribe();
}

function escapeHTML(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function appendBuyerChatMessage(msg) {
  const box = document.getElementById("buyerChatMessages");
  if (!box || !msg) return;

  if (renderedBuyerMessageIds.has(msg.id)) return;
  renderedBuyerMessageIds.add(msg.id);

  const item = document.createElement("div");
  item.className = `chat-bubble ${msg.sender_role === "buyer" ? "me" : "other"}`;

  item.innerHTML = `
    <p>${escapeHTML(msg.message)}</p>
    <small>${new Date(msg.created_at).toLocaleString("zh-TW")}</small>
  `;

  box.appendChild(item);
  box.scrollTop = box.scrollHeight;
}

function renderBuyerChatMessages(messages) {
  const box = document.getElementById("buyerChatMessages");
  if (!box) return;

  box.innerHTML = "";
  renderedBuyerMessageIds.clear();

  messages.forEach((msg) => {
    appendBuyerChatMessage(msg);
  });

  box.scrollTop = box.scrollHeight;
}

async function sendBuyerChatMessage() {
  const input = document.getElementById("buyerChatInput");
  const message = input?.value.trim();

  if (!message || !currentBuyerChatThreadId) return;

  const user = await getCurrentUser();

  if (!user) {
    alert("請先登入");
    return;
  }

  const { data, error } = await supabase
    .from("chat_messages")
    .insert([
      {
        thread_id: currentBuyerChatThreadId,
        sender_id: user.id,
        sender_role: "buyer",
        message
      }
    ])
    .select("*")
    .single();

  if (error) {
    console.error("送出訊息失敗:", error);
    alert("送出失敗");
    return;
  }

  await supabase
    .from("chat_threads")
    .update({
      last_message: message,
      last_message_at: new Date().toISOString()
    })
    .eq("id", currentBuyerChatThreadId);

  input.value = "";
  appendBuyerChatMessage(data);
}

async function replyBuyerChat(threadId) {
  const user = await getCurrentUser();
  const { data: messages, error: msgError } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("thread_id", Number(threadId))
    .order("created_at", { ascending: true });

  if (msgError) {
    console.error("讀取聊天內容失敗:", msgError);
  }

  const historyText = (messages || [])
    .map((msg) => {
      const name = msg.sender_role === "buyer" ? "我" : "賣家";
      return `${name}：${msg.message}`;
    })
    .join("\n");

  if (!user) {
    alert("請先登入");
    return;
  }

  const message = prompt(
    `聊天紀錄：\n\n${historyText || "目前沒有訊息"}\n\n請輸入回覆內容：`
  );

  if (!message || !message.trim()) return;

  const { error } = await supabase
    .from("chat_messages")
    .insert([
      {
        thread_id: Number(threadId),
        sender_id: user.id,
        sender_role: "buyer",
        message: message.trim()
      }
    ]);

  if (error) {
    console.error("買家回覆失敗:", error);
    alert("回覆失敗");
    return;
  }

  await supabase
    .from("chat_threads")
    .update({
      last_message: message.trim(),
      last_message_at: new Date().toISOString()
    })
    .eq("id", threadId);

  alert("已送出回覆。");
  await loadBuyerChats();
}

document.addEventListener("click", (e) => {
  if (!buyerBellDropdown || !buyerChatBell) return;

  const clickedInsideBell =
    buyerChatBell.contains(e.target) || buyerBellDropdown.contains(e.target);

  if (!clickedInsideBell) {
    buyerBellDropdown.classList.add("hidden");
  }
});

async function startCarChat(car, message) {
  const user = await getCurrentUser();

  if (!user) {
    alert("請先登入會員。");
    window.location.href = "login.html";
    return;
  }

  if (!car.store_id) {
    alert("這台車沒有對應車行，暫時無法聯絡。");
    return;
  }

  let { data: thread, error: threadError } = await supabase
    .from("chat_threads")
    .select("*")
    .eq("buyer_id", user.id)
    .eq("store_id", car.store_id)
    .eq("car_id", car.id)
    .maybeSingle();

  if (threadError) {
    console.error("讀取聊天室失敗:", threadError);
    alert("建立聊天室失敗");
    return;
  }

  if (!thread) {
    const { data: newThread, error: createError } = await supabase
      .from("chat_threads")
      .insert([
        {
          buyer_id: user.id,
          store_id: car.store_id,
          car_id: car.id,
          last_message: message,
          last_message_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (createError) {
      console.error("建立聊天室失敗:", createError);
      alert("建立聊天室失敗");
      return;
    }

    thread = newThread;
  }

  const { error: messageError } = await supabase
    .from("chat_messages")
    .insert([
      {
        thread_id: thread.id,
        sender_id: user.id,
        sender_role: "buyer",
        message
      }
    ]);

  if (messageError) {
    console.error("送出訊息失敗:", messageError);
    alert("送出訊息失敗");
    return;
  }

  await supabase
    .from("chat_threads")
    .update({
      last_message: message,
      last_message_at: new Date().toISOString()
    })
    .eq("id", thread.id);

  window.location.href = `member.html?tab=chat&thread=${thread.id}`;
}

async function loadComparePage() {
  const compareWrap = document.getElementById("compareTableWrap");
  if (!compareWrap) return;

  const compareIds = getCompareIds();

  if (compareIds.length < 2) {
    compareWrap.innerHTML = `
      <p>請先選擇至少 2 台車進行比較。</p>
      <a href="index.html#carSection" class="compare-back-btn">回車輛列表</a>
    `;
    return;
  }

  compareWrap.innerHTML = "<p>比較資料讀取中...</p>";

  const { data, error } = await supabase
    .from("cars")
    .select(`
      id,
      title,
      image,
      price,
      year,
      mileage,
      cc,
      category,
      region,
      brand,
      model,
      stores (
        name
      )
    `)
    .in("id", compareIds);

  if (error) {
    console.error("讀取比較車輛失敗:", error);
    compareWrap.innerHTML = "<p>讀取比較資料失敗。</p>";
    return;
  }

  const cars = compareIds
    .map((id) => data.find((car) => String(car.id) === String(id)))
    .filter(Boolean);

  compareWrap.innerHTML = `
    <div class="compare-table" style="--compare-count:${cars.length}">
      <div class="compare-row compare-head">
        <div class="compare-label">項目</div>
        ${cars.map((car) => `
          <div class="compare-car-head">
            <img src="${car.image || ""}" alt="${car.title}">
            <strong>${car.title}</strong>
          </div>
        `).join("")}
      </div>

      ${renderCompareRow("價格", cars.map(car => car.price ? `NT$ ${Number(car.price).toLocaleString()}` : "未填"))}
      ${renderCompareRow("年份", cars.map(car => car.year ? `${car.year} 年` : "未填"))}
      ${renderCompareRow("里程", cars.map(car => car.mileage ? `${Number(car.mileage).toLocaleString()} km` : "未填"))}
      ${renderCompareRow("排氣量", cars.map(car => car.cc ? `${car.cc} cc` : "未填"))}
      ${renderCompareRow("車型分類", cars.map(car => car.category || "未填"))}
      ${renderCompareRow("地區", cars.map(car => car.region || "未填"))}
      ${renderCompareRow("車行", cars.map(car => car.stores?.name || "未填"))}
    </div>

    <div class="compare-page-actions">
      <a href="index.html#carSection">繼續看車</a>
      <button id="clearCompareOnPageBtn" type="button">清除比較</button>
    </div>
  `;

  const clearBtn = document.getElementById("clearCompareOnPageBtn");
  if (clearBtn) {
    clearBtn.onclick = () => {
      saveCompareIds([]);
      window.location.href = "index.html#carSection";
    };
  }
}

function renderCompareRow(label, values) {
  return `
    <div class="compare-row">
      <div class="compare-label">${label}</div>
      ${values.map(value => `<div class="compare-value">${value}</div>`).join("")}
    </div>
  `;
}

loadComparePage();
renderCompareBar();

loadFavoriteCars();
updateBuyerChatBadge();
subscribeBuyerBellRealtime();
openMemberTabFromUrl();