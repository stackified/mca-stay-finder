/**
 * "Where to live" localities near the top 6 campuses — SPEC §11.6.
 * All-in ₹/month. Coordinates are approximate locality centres: verify with geocode.ts.
 */
import type { Locality } from '../../src/types/domain.ts'
import { k } from './util.ts'

// prettier-ignore
export const LOCALITIES: Locality[] = [
  // NIT Warangal
  { id: 'nitw-fathima-nagar', collegeId: 'nit-warangal', name: 'Fathima Nagar (NIT gate)', lat: 17.99, lng: 79.535, distanceKm: { min: 0, max: 1 }, vibe: 'Student hub, walkable', pgDoubleAllIn: k(8.5, 11), flat1bhkAllIn: k(14.5, 20), bungalowAllIn: k(24, 34), fit: 'best' },
  { id: 'nitw-kazipet', collegeId: 'nit-warangal', name: 'Kazipet', lat: 17.972, lng: 79.502, distanceKm: { min: 2, max: 3 }, vibe: 'Cheapest, railway junction', pgDoubleAllIn: k(8, 10.5), flat1bhkAllIn: k(14, 19), bungalowAllIn: k(23, 32), fit: 'budget' },
  { id: 'nitw-hanamkonda', collegeId: 'nit-warangal', name: 'Hanamkonda (Subedari / Nakkalagutta)', lat: 18.005, lng: 79.56, distanceKm: { min: 4, max: 6 }, vibe: 'Best lifestyle in city', pgDoubleAllIn: k(9.5, 12.5), flat1bhkAllIn: k(16, 23.5), bungalowAllIn: k(27, 40), fit: 'comfort' },
  // NIT Trichy
  { id: 'nitt-thuvakudi', collegeId: 'nit-trichy', name: 'Thuvakudi', lat: 10.753, lng: 78.829, distanceKm: { min: 0, max: 3 }, vibe: 'Quiet, limited options', pgDoubleAllIn: k(8.5, 11), flat1bhkAllIn: k(14, 19), bungalowAllIn: k(22, 32), fit: 'best' },
  { id: 'nitt-thiruverumbur', collegeId: 'nit-trichy', name: 'Thiruverumbur / BHEL area', lat: 10.7765, lng: 78.7742, distanceKm: { min: 7, max: 10 }, vibe: 'Township feel', pgDoubleAllIn: k(9, 12), flat1bhkAllIn: k(15, 21), bungalowAllIn: k(24, 36), fit: 'ok' },
  { id: 'nitt-city', collegeId: 'nit-trichy', name: 'City (KK Nagar / Thillai Nagar)', lat: 10.826, lng: 78.684, distanceKm: { min: 18, max: 22 }, vibe: 'Best amenities', pgDoubleAllIn: k(10, 13.5), flat1bhkAllIn: k(18, 24.5), bungalowAllIn: k(30, 41.5), fit: 'too-far' },
  // MNNIT Allahabad
  { id: 'mnnit-teliarganj', collegeId: 'mnnit-allahabad', name: 'Teliarganj', lat: 25.495, lng: 81.86, distanceKm: { min: 0, max: 1 }, vibe: 'Student hub, many PGs', pgDoubleAllIn: k(9, 12.5), flat1bhkAllIn: k(15, 22), bungalowAllIn: k(26, 38), fit: 'best' },
  { id: 'mnnit-shivkuti-salori', collegeId: 'mnnit-allahabad', name: 'Shivkuti / Salori', lat: 25.476, lng: 81.866, distanceKm: { min: 2, max: 4 }, vibe: 'Cheapest', pgDoubleAllIn: k(8, 11), flat1bhkAllIn: k(14.5, 20), bungalowAllIn: k(24, 34), fit: 'budget' },
  { id: 'mnnit-civil-lines', collegeId: 'mnnit-allahabad', name: 'Civil Lines / Ashok Nagar', lat: 25.452, lng: 81.835, distanceKm: { min: 4, max: 6 }, vibe: 'Best standard of living', pgDoubleAllIn: k(10.5, 13.5), flat1bhkAllIn: k(18, 25), bungalowAllIn: k(32, 45), fit: 'comfort' },
  // NIT Jamshedpur
  { id: 'nitjsr-adityapur', collegeId: 'nit-jamshedpur', name: 'Adityapur', lat: 22.784, lng: 86.155, distanceKm: { min: 0, max: 3 }, vibe: 'Cheapest, closest', pgDoubleAllIn: k(8, 11), flat1bhkAllIn: k(15, 20), bungalowAllIn: k(25, 35), fit: 'best' },
  { id: 'nitjsr-sonari-kadma', collegeId: 'nit-jamshedpur', name: 'Sonari / Kadma', lat: 22.814, lng: 86.17, distanceKm: { min: 4, max: 7 }, vibe: 'Green Tata township', pgDoubleAllIn: k(9, 12), flat1bhkAllIn: k(17, 23), bungalowAllIn: k(30, 42), fit: 'comfort' },
  { id: 'nitjsr-bistupur-sakchi', collegeId: 'nit-jamshedpur', name: 'Bistupur / Sakchi', lat: 22.7925, lng: 86.1842, distanceKm: { min: 6, max: 9 }, vibe: 'Main city, malls', pgDoubleAllIn: k(10, 13), flat1bhkAllIn: k(18, 25), bungalowAllIn: k(32, 44), fit: 'ok' },
  // MANIT Bhopal
  { id: 'manit-kotra', collegeId: 'manit-bhopal', name: 'Kotra / Mata Mandir', lat: 23.226, lng: 77.396, distanceKm: { min: 0, max: 2 }, vibe: 'Student area', pgDoubleAllIn: k(9.5, 12.5), flat1bhkAllIn: k(16, 22), bungalowAllIn: k(28, 40), fit: 'best' },
  { id: 'manit-arera', collegeId: 'manit-bhopal', name: 'Shivaji Nagar / TT Nagar / Arera Colony', lat: 23.22, lng: 77.428, distanceKm: { min: 2, max: 5 }, vibe: 'Upscale, green', pgDoubleAllIn: k(11, 14), flat1bhkAllIn: k(19, 26.5), bungalowAllIn: k(35, 48.5), fit: 'comfort' },
  { id: 'manit-mp-nagar', collegeId: 'manit-bhopal', name: 'MP Nagar', lat: 23.233, lng: 77.434, distanceKm: { min: 4, max: 6 }, vibe: 'Commercial, many PGs', pgDoubleAllIn: k(10, 13), flat1bhkAllIn: k(17, 24), bungalowAllIn: k(30, 42), fit: 'ok' },
  // NIT Raipur
  { id: 'nitrr-daganiya', collegeId: 'nit-raipur', name: 'Daganiya / Kota / Rohinipuram', lat: 21.245, lng: 81.6, distanceKm: { min: 0, max: 3 }, vibe: 'Student belt', pgDoubleAllIn: k(8.5, 11), flat1bhkAllIn: k(15.5, 21), bungalowAllIn: k(26, 36), fit: 'best' },
  { id: 'nitrr-tatibandh', collegeId: 'nit-raipur', name: 'Tatibandh / Amanaka', lat: 21.255, lng: 81.58, distanceKm: { min: 3, max: 5 }, vibe: 'Cheaper, quieter', pgDoubleAllIn: k(8.5, 11.5), flat1bhkAllIn: k(15.5, 21), bungalowAllIn: k(26, 36), fit: 'budget' },
  { id: 'nitrr-shankar-nagar', collegeId: 'nit-raipur', name: 'Shankar Nagar / Civil Lines', lat: 21.253, lng: 81.66, distanceKm: { min: 5, max: 8 }, vibe: 'Best standard of living', pgDoubleAllIn: k(10, 13.5), flat1bhkAllIn: k(18, 25.5), bungalowAllIn: k(32, 44.5), fit: 'comfort' },
]
