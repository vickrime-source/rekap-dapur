import { Kitchen, Store, OrderItem, MasterToko, MasterPemasok, MasterDapur } from '../types';
import { getTodayWIB } from '../lib/formatters';

export const INITIAL_MASTER_TOKO: MasterToko[] = [
  { id: 'toko-lb', nama: 'LB / Luweng Boga' },
  { id: 'toko-htg', nama: 'HTG' },
  { id: 'toko-la', nama: 'LA / Lumbung Adifruta' },
  { id: 'toko-pw', nama: 'PW / Prohe' }
];

export const INITIAL_MASTER_PEMASOK: MasterPemasok[] = [
  { id: 'pemasok-1', nama: 'Pemasok 1' },
  { id: 'pemasok-2', nama: 'Pemasok 2' },
  { id: 'pemasok-3', nama: 'Pemasok 3' },
  { id: 'pemasok-4', nama: 'Pemasok 4' }
];

export const INITIAL_PEMASOK: string[] = [
  "Pemasok 1",
  "Pemasok 2",
  "Pemasok 3",
  "Pemasok 4"
];

export const INITIAL_STORES: Store[] = [
  {
    "id": "st-lb",
    "nama": "LB / Luweng Boga",
    "lokasi": "Depo Makanan"
  },
  {
    "id": "st-htg",
    "nama": "HTG",
    "lokasi": "CV. HANDAI TOLAN GROUP"
  },
  {
    "id": "st-la",
    "nama": "LA / Lumbung Adifruta",
    "lokasi": "Distributor Buah"
  },
  {
    "id": "st-pw",
    "nama": "PW / Prohe",
    "lokasi": "Gudang Protein"
  }
];

export const INITIAL_MASTER_DAPUR: MasterDapur[] = [
  { id: "kt-kedayunan", nama: "Kedayunan", alamat: "Kec. Kabat, Banyuwangi" },
  { id: "kt-siliragung", nama: "Siliragung", alamat: "Kec. Siliragung, Banyuwangi" },
  { id: "kt-banjarsari", nama: "Banjarsari 2", alamat: "Kec. Glagah, Banyuwangi" },
  { id: "kt-wringinputih-2", nama: "Wringinputih 2", alamat: "Kec. Muncar, Banyuwangi" },
  { id: "kt-wringinputih-4", nama: "Wringinputih 4", alamat: "Kec. Muncar, Banyuwangi" },
  { id: "kt-singojuruh", nama: "Singojuruh", alamat: "Kec. Singojuruh, Banyuwangi" },
  { id: "kt-cluring", nama: "Cluring", alamat: "Kec. Cluring, Banyuwangi" },
  { id: "kt-tamansari", nama: "Tamansari", alamat: "Kec. Licin, Banyuwangi" },
  { id: "kt-wongsorejo", nama: "Wongsorejo", alamat: "Kec. Wongsorejo, Banyuwangi" },
  { id: "kt-sumberagung", nama: "Sumberagung", alamat: "Kec. Pesanggaran, Banyuwangi" },
  { id: "kt-mojoroto", nama: "Mojoroto", alamat: "Banyuwangi" },
  { id: "kt-tapanrejo", nama: "Tapanrejo", alamat: "Kec. Muncar, Banyuwangi" },
  { id: "kt-kendalrejo", nama: "Kendalrejo", alamat: "Kec. Tegaldlimo, Banyuwangi" },
  { id: "kt-gambiran", nama: "Gambiran", alamat: "Kec. Gambiran, Banyuwangi" },
  { id: "kt-pidis", nama: "Pidis", alamat: "Banyuwangi" },
  { id: "kt-kesilir-2", nama: "Kesilir 2", alamat: "Kec. Siliragung, Banyuwangi" },
  { id: "kt-mufid", nama: "Mufid", alamat: "Banyuwangi" },
  { id: "kt-rejoagung", nama: "Rejoagung", alamat: "Kec. Srono, Banyuwangi" },
  { id: "kt-ajeng", nama: "Ajeng", alamat: "Banyuwangi" },
  { id: "kt-pesanggaran", nama: "Pesanggaran", alamat: "Kec. Pesanggaran, Banyuwangi" },
  { id: "kt-bangorejo", nama: "Bangorejo", alamat: "Kec. Bangorejo, Banyuwangi" }
];

export const INITIAL_KITCHENS: Kitchen[] = INITIAL_MASTER_DAPUR;

export const DEFAULT_DATE = getTodayWIB();

export const INITIAL_ORDERS: OrderItem[] = [];
