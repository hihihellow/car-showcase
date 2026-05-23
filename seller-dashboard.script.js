import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

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

const sellerNavBtns = document.querySelectorAll(".seller-nav-btn");
const sellerPages = document.querySelectorAll(".seller-page");

function showSellerPage(pageName) {
  sellerPages.forEach((page) => {
    page.classList.add("hidden");
  });

  const targetPage = document.getElementById(`${pageName}Page`);

  if (targetPage) {
    targetPage.classList.remove("hidden");
  }

  sellerNavBtns.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === pageName);
  });
}

sellerNavBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    showSellerPage(btn.dataset.page);
  });
});

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
  updateOverviewCarCount();
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
        <p class="car-status-text">
          狀態：${car.status === "active" ? "上架中" : "已下架"}
        </p>
        <p class="car-status-text">
          精選：${car.is_featured ? "是" : "否"}
        </p>
      </div>

      <div class="admin-action-row">
        <button class="admin-edit-btn" data-id="${car.id}">
          編輯
        </button>

        <button class="toggle-status-btn" data-id="${car.id}">
          ${car.status === "active" ? "下架" : "重新上架"}
        </button>

        <button class="toggle-featured-btn" data-id="${car.id}">
          ${car.is_featured ? "取消精選" : "設為精選"}
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

  document.querySelectorAll(".toggle-status-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const carId = btn.dataset.id;
      await toggleCarStatus(carId);
    });
  });

  document.querySelectorAll(".toggle-featured-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const carId = btn.dataset.id;
      await toggleFeaturedCar(carId);
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

function updateOverviewCarCount() {
  const overviewActiveCars = document.getElementById("overviewActiveCars");
  if (!overviewActiveCars) return;

  const activeCount = adminCars.filter((car) => car.status === "active").length;
  overviewActiveCars.textContent = `${activeCount} 台`;
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

  showSellerPage("addCar");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

async function toggleCarStatus(carId) {
  const targetCar = adminCars.find((car) => String(car.id) === String(carId));

  if (!targetCar) {
    alert("找不到這台車");
    return;
  }

  const nextStatus = targetCar.status === "active" ? "inactive" : "active";

  // 之後付費功能會接在這裡
  // 如果 nextStatus === "active"，就檢查是否有有效方案
  if (nextStatus === "active") {
    const canActivate = true;

    if (!canActivate) {
      alert("請先完成付款或續約後，才能上架車輛。");
      return;
    }
  }

  let updateQuery = supabase
    .from("cars")
    .update({
      status: nextStatus
    })
    .eq("id", carId);

  if (currentSellerStore) {
    updateQuery = updateQuery.eq("store_id", currentSellerStore.id);
  }

  const { error } = await updateQuery;

  if (error) {
    console.error("更新上下架狀態失敗:", error);
    alert("更新上下架狀態失敗，請看 Console");
    return;
  }

  alert(nextStatus === "active" ? "車輛已重新上架" : "車輛已下架");
  loadAdminCars();
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

async function toggleFeaturedCar(carId) {
  const targetCar = adminCars.find((car) => String(car.id) === String(carId));

  if (!targetCar) {
    alert("找不到這台車");
    return;
  }

  const nextFeatured = !targetCar.is_featured;

  let updateQuery = supabase
    .from("cars")
    .update({
      is_featured: nextFeatured
    })
    .eq("id", carId);

  if (currentSellerStore) {
    updateQuery = updateQuery.eq("store_id", currentSellerStore.id);
  }

  const { error } = await updateQuery;

  if (error) {
    console.error("更新精選狀態失敗:", error);
    alert("更新精選狀態失敗，請看 Console");
    return;
  }

  alert(nextFeatured ? "已設為精選車" : "已取消精選");
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

const bannerFileInput = document.getElementById("storeBannerFile");
const logoFileInput = document.getElementById("storeLogoFile");
const bannerPreview = document.getElementById("bannerPreview");
const logoPreview = document.getElementById("logoPreview");

if (bannerFileInput) {
  bannerFileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const base64 = await fileToBase64(file);

    document.getElementById("storeBannerEdit").value = base64;

    if (bannerPreview) {
      bannerPreview.src = base64;
      bannerPreview.style.display = "block";
    }
  });
}

if (logoFileInput) {
  logoFileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const base64 = await fileToBase64(file);

    document.getElementById("storeLogoEdit").value = base64;

    if (logoPreview) {
      logoPreview.src = base64;
      logoPreview.style.display = "block";
    }
  });
}

async function loadSellerStoreSettings() {
  if (!isSellerDashboard) return;

  const nameInput = document.getElementById("storeNameEdit");
  const descInput = document.getElementById("storeDescEdit");
  const bannerInput = document.getElementById("storeBannerEdit");
  const logoInput = document.getElementById("storeLogoEdit");

  if (!nameInput) return;

  if (!currentSellerStore) {
    currentSellerStore = await getMyStore();
  }

  if (!currentSellerStore) return;

  const overviewStoreName = document.getElementById("overviewStoreName");
  const overviewStoreDesc = document.getElementById("overviewStoreDesc");
  const publicStoreLink = document.getElementById("publicStoreLink");

  if (overviewStoreName) {
    overviewStoreName.textContent = currentSellerStore.name || "尚未設定";
  }

  if (overviewStoreDesc) {
    overviewStoreDesc.textContent = currentSellerStore.description || "尚未填寫店面介紹";
  }

  if (publicStoreLink) {
    publicStoreLink.href = `store.html?store=${currentSellerStore.slug || currentSellerStore.id}`;
  }

  nameInput.value = currentSellerStore.name || "";
  descInput.value = currentSellerStore.description || "";
  bannerInput.value = currentSellerStore.banner_url || "";
  logoInput.value = currentSellerStore.logo_url || "";

  if (bannerPreview && currentSellerStore.banner_url) {
    bannerPreview.src = currentSellerStore.banner_url;
    bannerPreview.style.display = "block";
  }

  if (logoPreview && currentSellerStore.logo_url) {
    logoPreview.src = currentSellerStore.logo_url;
    logoPreview.style.display = "block";
  }
}

const saveStoreBtn = document.getElementById("saveStoreBtn");

if (saveStoreBtn) {
  saveStoreBtn.addEventListener("click", async () => {
    if (!currentSellerStore) {
      currentSellerStore = await getMyStore();
    }

    if (!currentSellerStore) {
      alert("找不到你的車行資料");
      return;
    }

    const name = document.getElementById("storeNameEdit").value.trim();
    const description = document.getElementById("storeDescEdit").value.trim();
    const banner_url = document.getElementById("storeBannerEdit").value.trim();
    const logo_url = document.getElementById("storeLogoEdit").value.trim();

    const { error } = await supabase
      .from("stores")
      .update({
        name,
        description,
        banner_url: banner_url || null,
        logo_url: logo_url || null
      })
      .eq("id", currentSellerStore.id);

    if (error) {
      console.error("更新店面資料失敗:", error);
      alert("更新店面資料失敗，請看 Console");
      return;
    }

    alert("店面資料已更新！");
    currentSellerStore = await getMyStore();
  });
}

loadSellerStoreSettings();
loadAdminCars();