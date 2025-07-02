export abstract class ExpMath {
  static expQ96(x: bigint): bigint {
    let r: bigint = 0n;
    // When the result is less than 0.5 we return zero.
    // This happens when `x <= floor(ln(1 / 2**96) * 2**96)`.
    if (x <= -5272010636899917441709581228290n) return r;

    // When the result is greater than `(2**255 - 1) / 2**96` we can not represent it as
    // an int. This happens when `x >= floor(log((2**255 - 1) / 2**96) * 2**96) ≈ 110 * 2**96`.
    if (!(x < 8731767617365488262831493909354n)) {
      throw new Error('ExpOverflow()');
    }

    // Reduce range of x to (-½ ln 2, ½ ln 2) * 2**96 by factoring out powers
    // of two such that exp(x) = exp(x') * 2**k, where k is an integer.
    // Solving this gives k = round(x / log(2)) and x' = x - k * log(2).
    let k: bigint =
      ((x << 96n) / 54916777467707473351141471128n + (1n << 95n)) >> 96n;
    x = x - k * 54916777467707473351141471128n;

    // `k` is in the range `[-61, 195]`.

    // Evaluate using a (6, 7)-term rational approximation.
    // `p` is made monic, we'll multiply by a scale factor later.
    let y: bigint = x + 1346386616545796478920950773328n;
    y = ((y * x) >> 96n) + 57155421227552351082224309758442n;
    let p: bigint = y + x - 94201549194550492254356042504812n;
    p = ((p * y) >> 96n) + 28719021644029726153956944680412240n;
    p = p * x + (4385272521454847904659076985693276n << 96n);

    // We leave `p` in `2**192` basis so we don't need to scale it back up for the division.
    let q: bigint = x - 2855989394907223263936484059900n;
    q = ((q * x) >> 96n) + 50020603652535783019961831881945n;
    q = ((q * x) >> 96n) - 533845033583426703283633433725380n;
    q = ((q * x) >> 96n) + 3604857256930695427073651918091429n;
    q = ((q * x) >> 96n) - 14423608567350463180887372962807573n;
    q = ((q * x) >> 96n) + 26449188498355588339934803723976023n;

    // Div in assembly because solidity adds a zero check despite the unchecked.
    // The q polynomial won't have zeros in the domain as all its roots are complex.
    // No scaling is necessary because p is already `2**96` too large.
    r = p / q;

    // r should be in the range `(0.09, 0.25) * 2**96`.

    // We now need to multiply r by:ß
    // - The scale factor `s ≈ 6.031367120`.
    // - The `2**k` factor from the range reduction.
    let shift: bigint = 117n - k;
    r =
      shift >= 0n
        ? (r * 1002132753603162656746435578141647308n) >> BigInt(shift)
        : (r * 1002132753603162656746435578141647308n) << BigInt(-shift);
    return r;
  }

  // from Gemini, gives max bigint errors
  static lnQ96(x: bigint): bigint {
    let r = (x > 0xffffffffffffffffffffffffffffffffn ? 1n : 0n) << 7n;
    r |= (x >> r > 0xffffffffffffffffn ? 1n : 0n) << 6n;
    r |= (x >> r > 0xffffffffn ? 1n : 0n) << 5n;
    r |= (x >> r > 0xffffn ? 1n : 0n) << 4n;
    r |= (x >> r > 0xffn ? 1n : 0n) << 3n;

    if (!(x > 0n)) {
      throw new Error('LnQ96Undefined()');
    }

    r =
      r ^
      ((0xf8f9f9faf9fdfafbf9fdfcfdfafbfcfef9fafdfafcfcfbfefafafcfbffffffffn >>
        ((31n - ((0x8421084210842108cc6318c6db6d54ben >> (x >> r)) & 0x1fn)) *
          8n)) &
        0xffn);
    x = x >> (159n - r);

    let p: bigint =
      (((43456485725739037958740375743393n +
        (((24828157081833163892658089445524n +
          (((3273285459638523848632254066296n + x) * x) >> 96n)) *
          x) >>
          96n)) *
        x) >>
        96n) -
      11111509109440967052023855526967n;
    p = ((p * x) >> 96n) - 45023709667254063763336534515857n;
    p = ((p * x) >> 96n) - 14706773417378608786704636184526n;
    p = p * x - (795164235651350426258249787498n << 96n);

    let q: bigint = 5573035233440673466300451813936n + x;
    q = 71694874799317883764090561454958n + ((x * q) >> 96n);
    q = 283447036172924575727196451306956n + ((x * q) >> 96n);
    q = 401686690394027663651624208769553n + ((x * q) >> 96n);
    q = 204048457590392012362485061816622n + ((x * q) >> 96n);
    q = 31853899698501571402653359427138n + ((x * q) >> 96n);
    q = 909429971244387300277376558375n + ((x * q) >> 96n);

    p = p / q;
    p = p * 439668470185123797622540459591n;
    p =
      p +
      4350955369971217654477563090224794165364344896676135745069n * (159n - r);

    r = p >> 96n;
    return r;
  }

  static lnQ96RoundingUp(x: bigint): bigint {
    let r = (x > 0xffffffffffffffffffffffffffffffffn ? 1n : 0n) << 7n;
    r |= (x >> r > 0xffffffffffffffffn ? 1n : 0n) << 6n;
    r |= (x >> r > 0xffffffffn ? 1n : 0n) << 5n;
    r |= (x >> r > 0xffffn ? 1n : 0n) << 4n;
    r |= (x >> r > 0xffn ? 1n : 0n) << 3n;

    if (!(x > 0n)) {
      throw new Error('LnQ96Undefined()');
    }

    r =
      r ^
      ((0xf8f9f9faf9fdfafbf9fdfcfdfafbfcfef9fafdfafcfcfbfefafafcfbffffffffn >>
        ((31n - ((0x8421084210842108cc6318c6db6d54ben >> (x >> r)) & 0x1fn)) *
          8n)) &
        0xffn);
    x = x >> (159n - r);

    let p: bigint =
      (((43456485725739037958740375743393n +
        (((24828157081833163892658089445524n +
          (((3273285459638523848632254066296n + x) * x) >> 96n)) *
          x) >>
          96n)) *
        x) >>
        96n) -
      11111509109440967052023855526967n;
    p = ((p * x) >> 96n) - 45023709667254063763336534515857n;
    p = ((p * x) >> 96n) - 14706773417378608786704636184526n;
    p = p * x - (795164235651350426258249787498n << 96n);

    let q: bigint = 5573035233440673466300451813936n + x;
    q = 71694874799317883764090561454958n + ((x * q) >> 96n);
    q = 283447036172924575727196451306956n + ((x * q) >> 96n);
    q = 401686690394027663651624208769553n + ((x * q) >> 96n);
    q = 204048457590392012362485061816622n + ((x * q) >> 96n);
    q = 31853899698501571402653359427138n + ((x * q) >> 96n);
    q = 909429971244387300277376558375n + ((x * q) >> 96n);

    p = p / q;
    p = p * 439668470185123797622540459591n;
    p =
      p +
      4350955369971217654477563090224794165364344896676135745069n * (159n - r);
    r = p >> 96n;

    if ((p & 0xffffffffffffffffffffffffn) !== 0n) r += 1n;
    return r;
  }

  // from Grok seems to work better withut errors
  //   static lnQ96RoundingUp(x: bigint): bigint {
  //     console.log('checl')
  //     if (x <= 0n) {
  //         throw new Error("LnQ96Undefined");
  //     }

  //     // Compute k = log2(x) - 96, r = 159 - k = 255 - log2(x) = 255 ^ log2(x)
  //     let r = 0n;
  //     if (x > 0xffffffffffffffffffffffffffffffffn) r |= 1n << 7n;
  //     r |= (x >> r > 0xffffffffffffffffn ? 1n : 0n) << 6n;
  //     r |= (x >> r > 0xffffffffn ? 1n : 0n) << 5n;
  //     r |= (x >> r > 0xffffn ? 1n : 0n) << 4n;
  //     r |= (x >> r > 0xffn ? 1n : 0n) << 3n;

  //     const lookupTable = 0xf8f9f9faf9fdfafbf9fdfcfdfafbfcfef9fafdfafcfcfbfefafafcfbn;
  //     const shift = BigInt((x >> r) & 0x1fn);
  //     r ^= (lookupTable >> shift) & 0xffn;

  //     // Reduce range of x to (1, 2) * 2**96
  //     x = (x << r) >> 159n;

  //     // Evaluate using a (8, 8)-term rational approximation
  //     let p = x;
  //     p = (p + 3273285459638523848632254066296n) * x >> 96n;
  //     p = (p + 24828157081833163892658089445524n) * x >> 96n;
  //     p = (p + 43456485725739037958740375743393n) * x >> 96n;
  //     p -= 11111509109440967052023855526967n;
  //     p = p * x >> 96n;
  //     p -= 45023709667254063763336534515857n;
  //     p = p * x >> 96n;
  //     p -= 14706773417378608786704636184526n;
  //     p = p * x;
  //     p -= 795164235651350426258249787498n << 96n;

  //     // q is monic
  //     let q = x + 5573035233440673466300451813936n;
  //     q = ((x * q) >> 96n) + 71694874799317883764090561454958n;
  //     q = ((x * q) >> 96n) + 283447036172924575727196451306956n;
  //     q = ((x * q) >> 96n) + 401686690394027663651624208769553n;
  //     q = ((x * q) >> 96n) + 204048457590392012362485061816622n;
  //     q = ((x * q) >> 96n) + 31853899698501571402653359427138n;
  //     q = ((x * q) >> 96n) + 909429971244387300277376558375n;

  //     // p / q is in the range (0, 0.125) * 2**96
  //     p = p / q;
  //     // Multiply by scaling factor: s * 2**96
  //     p = p * 439668470185123797622540459591n;
  //     // Add ln(2) * k * 2**192
  //     p += (159n - r) * 4350955369971217654477563090224794165364344896676135745069n;
  //     // Base conversion: div 2**96
  //     let result = p >> 96n;
  //     // Round up if needed
  //     if ((p & 0xffffffffffffffffffffffffn) !== 0n) {
  //         result += 1n;
  //     }

  //     return result;
  // }

  static getSqrtPriceAtTickWad(tickWad: bigint): bigint {
    // TODO
    return 0n;
  }
}
