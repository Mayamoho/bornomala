/**
 * Location, at two precisions, because two very different people send these.
 *
 * A phone with GPS sends `precise`: latitude and longitude quantised to 16
 * bits each inside the Bangladesh bounding box. That is about 10 m north-south
 * and 7 m east-west anywhere in the country, in 32 bits — five characters.
 *
 * Someone reading a message off a printed card, or dictating one over a voice
 * call from a button phone, sends `district`: a 6-bit index into the 64
 * districts. Six bits, one character, no GPS, no arithmetic. The district
 * table is printed on the decode card, so the whole path works on paper.
 *
 * Both travel in the same slot behind a one-bit mode flag. A message degrades
 * from metres to district without changing format — which is the point: the
 * wire format itself degrades gracefully.
 */

export const LAT_MIN = 20.5;
export const LAT_MAX = 26.75;
export const LON_MIN = 88.0;
export const LON_MAX = 92.75;

const STEPS = 2 ** 16;

/** The 64 districts, in division order. Index is the wire value. */
export const DISTRICTS = [
  // Barishal (0-5)
  { bn: 'বরগুনা', en: 'Barguna' },
  { bn: 'বরিশাল', en: 'Barishal' },
  { bn: 'ভোলা', en: 'Bhola' },
  { bn: 'ঝালকাঠি', en: 'Jhalokati' },
  { bn: 'পটুয়াখালী', en: 'Patuakhali' },
  { bn: 'পিরোজপুর', en: 'Pirojpur' },
  // Chattogram (6-16)
  { bn: 'বান্দরবান', en: 'Bandarban' },
  { bn: 'ব্রাহ্মণবাড়িয়া', en: 'Brahmanbaria' },
  { bn: 'চাঁদপুর', en: 'Chandpur' },
  { bn: 'চট্টগ্রাম', en: 'Chattogram' },
  { bn: 'কুমিল্লা', en: 'Cumilla' },
  { bn: 'কক্সবাজার', en: "Cox's Bazar" },
  { bn: 'ফেনী', en: 'Feni' },
  { bn: 'খাগড়াছড়ি', en: 'Khagrachhari' },
  { bn: 'লক্ষ্মীপুর', en: 'Lakshmipur' },
  { bn: 'নোয়াখালী', en: 'Noakhali' },
  { bn: 'রাঙ্গামাটি', en: 'Rangamati' },
  // Dhaka (17-29)
  { bn: 'ঢাকা', en: 'Dhaka' },
  { bn: 'ফরিদপুর', en: 'Faridpur' },
  { bn: 'গাজীপুর', en: 'Gazipur' },
  { bn: 'গোপালগঞ্জ', en: 'Gopalganj' },
  { bn: 'কিশোরগঞ্জ', en: 'Kishoreganj' },
  { bn: 'মাদারীপুর', en: 'Madaripur' },
  { bn: 'মানিকগঞ্জ', en: 'Manikganj' },
  { bn: 'মুন্সিগঞ্জ', en: 'Munshiganj' },
  { bn: 'নারায়ণগঞ্জ', en: 'Narayanganj' },
  { bn: 'নরসিংদী', en: 'Narsingdi' },
  { bn: 'রাজবাড়ী', en: 'Rajbari' },
  { bn: 'শরীয়তপুর', en: 'Shariatpur' },
  { bn: 'টাঙ্গাইল', en: 'Tangail' },
  // Khulna (30-39)
  { bn: 'বাগেরহাট', en: 'Bagerhat' },
  { bn: 'চুয়াডাঙ্গা', en: 'Chuadanga' },
  { bn: 'যশোর', en: 'Jashore' },
  { bn: 'ঝিনাইদহ', en: 'Jhenaidah' },
  { bn: 'খুলনা', en: 'Khulna' },
  { bn: 'কুষ্টিয়া', en: 'Kushtia' },
  { bn: 'মাগুরা', en: 'Magura' },
  { bn: 'মেহেরপুর', en: 'Meherpur' },
  { bn: 'নড়াইল', en: 'Narail' },
  { bn: 'সাতক্ষীরা', en: 'Satkhira' },
  // Mymensingh (40-43)
  { bn: 'জামালপুর', en: 'Jamalpur' },
  { bn: 'ময়মনসিংহ', en: 'Mymensingh' },
  { bn: 'নেত্রকোণা', en: 'Netrokona' },
  { bn: 'শেরপুর', en: 'Sherpur' },
  // Rajshahi (44-51)
  { bn: 'বগুড়া', en: 'Bogura' },
  { bn: 'চাঁপাইনবাবগঞ্জ', en: 'Chapainawabganj' },
  { bn: 'জয়পুরহাট', en: 'Joypurhat' },
  { bn: 'নওগাঁ', en: 'Naogaon' },
  { bn: 'নাটোর', en: 'Natore' },
  { bn: 'পাবনা', en: 'Pabna' },
  { bn: 'রাজশাহী', en: 'Rajshahi' },
  { bn: 'সিরাজগঞ্জ', en: 'Sirajganj' },
  // Rangpur (52-59)
  { bn: 'দিনাজপুর', en: 'Dinajpur' },
  { bn: 'গাইবান্ধা', en: 'Gaibandha' },
  { bn: 'কুড়িগ্রাম', en: 'Kurigram' },
  { bn: 'লালমনিরহাট', en: 'Lalmonirhat' },
  { bn: 'নীলফামারী', en: 'Nilphamari' },
  { bn: 'পঞ্চগড়', en: 'Panchagarh' },
  { bn: 'রংপুর', en: 'Rangpur' },
  { bn: 'ঠাকুরগাঁও', en: 'Thakurgaon' },
  // Sylhet (60-63)
  { bn: 'হবিগঞ্জ', en: 'Habiganj' },
  { bn: 'মৌলভীবাজার', en: 'Moulvibazar' },
  { bn: 'সুনামগঞ্জ', en: 'Sunamganj' },
  { bn: 'সিলেট', en: 'Sylhet' },
];

function quantise(value, min, max) {
  const clamped = Math.min(Math.max(value, min), max);
  const step = Math.floor(((clamped - min) / (max - min)) * (STEPS - 1) + 0.5);
  return Math.min(Math.max(step, 0), STEPS - 1);
}

function dequantise(step, min, max) {
  return min + (step / (STEPS - 1)) * (max - min);
}

/** true when a coordinate is inside the box the 32-bit grid covers. */
export function inCoverage(lat, lon) {
  return lat >= LAT_MIN && lat <= LAT_MAX && lon >= LON_MIN && lon <= LON_MAX;
}

export function encodeCoords(lat, lon) {
  return {
    lat: quantise(lat, LAT_MIN, LAT_MAX),
    lon: quantise(lon, LON_MIN, LON_MAX),
  };
}

export function decodeCoords(latStep, lonStep) {
  return {
    lat: dequantise(latStep, LAT_MIN, LAT_MAX),
    lon: dequantise(lonStep, LON_MIN, LON_MAX),
  };
}

/** Metres per quantisation step at the centre of the country, for the README. */
export function gridResolution() {
  const midLat = (LAT_MIN + LAT_MAX) / 2;
  const latMetres = ((LAT_MAX - LAT_MIN) / (STEPS - 1)) * 111_320;
  const lonMetres =
    ((LON_MAX - LON_MIN) / (STEPS - 1)) * 111_320 * Math.cos((midLat * Math.PI) / 180);
  return { latMetres, lonMetres };
}

export function districtName(index, lang = 'bn') {
  const district = DISTRICTS[index];
  if (!district) throw new RangeError(`no district ${index}`);
  return district[lang];
}
