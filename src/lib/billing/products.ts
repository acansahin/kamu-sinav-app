/**
 * Google Play ürün kimlikleri — tek kaynak.
 *
 * Bu dize Play Console'daki ürünle BİREBİR aynı olmak zorundadır ve ürün bir
 * kez oluşturulduktan sonra **değiştirilemez**; silinen bir kimlik de yeniden
 * kullanılamaz. Bu yüzden koda gömülü tek yer burasıdır.
 *
 * Ürün türü "managed product" (tek seferlik, ömür boyu). Abonelik DEĞİLDİR ve
 * `consume` asla çağrılmaz — tüketilen bir satın alma Play'de kaybolur ve
 * kullanıcı ödediği erişimi geri alamaz.
 */
export const FULL_ACCESS_PRODUCT_ID = "tam_erisim";
