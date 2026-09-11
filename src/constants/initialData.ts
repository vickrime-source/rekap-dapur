import { Kitchen, Store, OrderItem, MasterToko, MasterPemasok, MasterDapur } from '../types';
import { getTodayWIB } from '../lib/formatters';

export const INITIAL_MASTER_TOKO: MasterToko[] = [
  { id: 'toko-lb', nama: 'LB / Luweng Boga' },
  { id: 'toko-htg', nama: 'HTG' },
  { id: 'toko-la', nama: 'LA / Lumbung Adifruta' },
  { id: 'toko-pw', nama: 'PW / Prohe' }
];

export const INITIAL_MASTER_PEMASOK: MasterPemasok[] = [
  { id: 'pemasok-ajeng-fruits', nama: 'Ajeng fruits' },
  { id: 'pemasok-sari-buah', nama: 'Sari buah' },
  { id: 'pemasok-buah-mulyo', nama: 'Buah mulyo' },
  { id: 'pemasok-arnis-buah', nama: 'Arnis buah' },
  { id: 'pemasok-pmb', nama: 'PMB' },
  { id: 'pemasok-diah-buah', nama: 'Diah Buah' },
  { id: 'pemasok-pak-jarwo', nama: 'Pak Jarwo' },
  { id: 'pemasok-handoyo', nama: 'Handoyo' },
  { id: 'pemasok-pak-nyoto', nama: 'Pak nyoto' },
  { id: 'pemasok-pak-bahtiar', nama: 'Pak bahtiar' },
  { id: 'pemasok-salak-senepo', nama: 'Salak senepo' },
  { id: 'pemasok-crystal-fruits', nama: 'Crystal fruits' },
  { id: 'pemasok-indo-sayur', nama: 'indo sayur' },
  { id: 'pemasok-toko-daging-sapi-bwi', nama: 'Toko daging sapi banyuwangi' },
  { id: 'pemasok-raja-ayam', nama: 'Raja ayam' },
  { id: 'pemasok-bu-tiah', nama: 'Bu Tiah' },
  { id: 'pemasok-vazio', nama: 'Vazio' },
  { id: 'pemasok-pak-hadi', nama: 'Pak Hadi' },
  { id: 'pemasok-yogo', nama: 'Yogo' },
  { id: 'pemasok-roti-pradana', nama: 'Roti Pradana' },
  { id: 'pemasok-pak-toha', nama: 'Pak Toha' },
  { id: 'pemasok-nur-cavendish', nama: 'Nur Cavendish' },
  { id: 'pemasok-juhari-cavendish', nama: 'Juhari Cavendish' },
  { id: 'pemasok-mecca', nama: 'Mecca' },
  { id: 'pemasok-lontong-sempu', nama: 'Lontong sempu' },
  { id: 'pemasok-ladju-snack', nama: 'Ladju snack' },
  { id: 'pemasok-pak-adi-edamame', nama: 'Pak adi edamame' },
  { id: 'pemasok-pak-wargito-ndok-asin', nama: 'Pak wargito Ndok Asin' },
  { id: 'pemasok-suparti', nama: 'Suparti' },
  { id: 'pemasok-eko-lele', nama: 'Eko lele' },
  { id: 'pemasok-king', nama: 'King' },
  { id: 'pemasok-nur-patin', nama: 'Nur patin' },
  { id: 'pemasok-nanik-tuna', nama: 'Nanik tuna' },
  { id: 'pemasok-rambo-jambu-citra', nama: 'Rambo Jambu citra' }
];

export const INITIAL_PEMASOK: string[] = [
  'Ajeng fruits',
  'Sari buah',
  'Buah mulyo',
  'Arnis buah',
  'PMB',
  'Diah Buah',
  'Pak Jarwo',
  'Handoyo',
  'Pak nyoto',
  'Pak bahtiar',
  'Salak senepo',
  'Crystal fruits',
  'indo sayur',
  'Toko daging sapi banyuwangi',
  'Raja ayam',
  'Bu Tiah',
  'Vazio',
  'Pak Hadi',
  'Yogo',
  'Roti Pradana',
  'Pak Toha',
  'Nur Cavendish',
  'Juhari Cavendish',
  'Mecca',
  'Lontong sempu',
  'Ladju snack',
  'Pak adi edamame',
  'Pak wargito Ndok Asin',
  'Suparti',
  'Eko lele',
  'King',
  'Nur patin',
  'Nanik tuna',
  'Rambo Jambu citra'
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
