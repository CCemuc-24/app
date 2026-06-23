// src/domain/rut.ts
// Ported from ccemuc-api/src/utils/rutValidator.ts — single canonical RUT validator.
// getFakeRut() and console.log side effects are intentionally dropped (YAGNI / purity).

export function getDV(rut: string): string | false {
  let acum = 0;
  let num = 0;
  let N = 0;

  if (rut.length === 8) {
    const factors = [3, 2, 7, 6, 5, 4, 3, 2];
    for (let i = 0; i < rut.length; i += 1) {
      num = parseInt(rut[i], 10);
      N = factors[i];
      num *= N;
      acum += num;
    }
  } else if (rut.length === 7) {
    const factors = [2, 7, 6, 5, 4, 3, 2];
    for (let i = 0; i < rut.length; i += 1) {
      num = parseInt(rut[i], 10);
      N = factors[i];
      num *= N;
      acum += num;
    }
  } else {
    return false;
  }

  const cuo = Math.floor(acum / 11);
  const remainder = 11 - (acum - cuo * 11);

  if (remainder === 11) return '0';
  if (remainder === 10) return 'K';
  return remainder.toString();
}

export function isRut(rut: string): { status: boolean; message: string } {
  const response = { status: false, message: 'Valid RUT' };

  if (rut.includes('.')) {
    response.message = 'RUT must not contain dots Format: XX.XXX.XXX-X';
    return response;
  }

  if (!rut.includes('-')) {
    response.message = 'RUT must contain dashes';
    return response;
  }

  const rutWithoutDv = rut.split('-')[0];
  const dv = rut.split('-')[1].toUpperCase();

  if (!(rutWithoutDv.length >= 7 && rutWithoutDv.length <= 8)) {
    response.message = 'RUT without DV must have 9 or 10 digits';
    return response;
  }

  const expectedDV = getDV(rutWithoutDv);

  if (expectedDV !== dv) {
    response.message = `Invalid DV. Expected: ${expectedDV}`;
    return response;
  }

  response.status = true;
  return response;
}
