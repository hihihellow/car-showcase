import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://sszyqmgrlxpwonfidkcr.supabase.co",
  "sb_publishable_DxGd6Yu_mXB1YqiUTxJdqA_CT17Rv27"
);

// =========================
// 車行店面頁 store.html
// =========================
const storeInfo = document.getElementById("storeInfo");
const storeCarList = document.getElementById("storeCarList");
const storeTitle = document.getElementById("storeTitle");
const storeDesc = document.getElementById("storeDesc");

async function loadStorePage() {
  if (!storeInfo || !storeCarList) return;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("store") || params.get("slug");

  let store = null;

  if (slug) {
    const { data, error } = await supabase
      .from("stores")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      console.error("讀取車行失敗:", error);
      storeTitle.textContent = "讀取車行失敗";
      storeDesc.textContent = "請稍後再試。";
      return;
    }

    store = data;
  } else {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;

    if (!user) {
      storeTitle.textContent = "找不到車行";
      storeDesc.textContent = "網址缺少車行代號。";
      return;
    }

    const { data, error } = await supabase
      .from("stores")
      .select("*")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("讀取自己的車行失敗:", error);
      storeTitle.textContent = "讀取車行失敗";
      storeDesc.textContent = "請稍後再試。";
      return;
    }

    store = data;

    if (store?.slug) {
      window.history.replaceState(
        null,
        "",
        `store.html?store=${encodeURIComponent(store.slug)}`
      );
    }
  }

  if (!store) {
    storeTitle.textContent = "找不到這間車行";
    storeDesc.textContent = "請確認網址是否正確。";
    return;
  }

  document.title = `${store.name}｜澄品汽車`;
  storeTitle.textContent = store.name;
  storeDesc.textContent = store.description || "優質車行，嚴選好車。";

  storeInfo.innerHTML = `
    <div class="store-card">
      ${
        store.banner_url
          ? `<img src="${store.banner_url}" class="store-banner-img" alt="${store.name}">`
          : `<div class="store-banner-placeholder">${store.name}</div>`
      }

      <div class="store-card-body">
        ${
          store.logo_url
            ? `<img src="${store.logo_url}" class="store-logo-img" alt="${store.name} Logo">`
            : ""
        }

        <h2>${store.name}</h2>
        <p>${store.description || "這間車行尚未填寫介紹。"}</p>
      </div>
    </div>
  `;

  const { data: cars, error: carsError } = await supabase
    .from("cars")
    .select("*")
    .eq("store_id", store.id)
    .eq("status", "active")
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (carsError) {
    console.error("讀取車行車輛失敗:", carsError);
    storeCarList.innerHTML = "<p>讀取車輛失敗，請看 Console。</p>";
    return;
  }

  if (!cars || cars.length === 0) {
    storeCarList.innerHTML = "<p>這間車行目前尚未上架車輛。</p>";
    return;
  }

  storeCarList.innerHTML = "";

  cars.forEach((car) => {
    const card = document.createElement("div");
    card.className = "car-card";

    card.innerHTML = `
      <a href="detail.html?id=${car.id}" class="car-link">
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

    storeCarList.appendChild(card);
  });
}

loadStorePage();