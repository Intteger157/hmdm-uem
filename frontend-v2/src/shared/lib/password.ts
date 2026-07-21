import { md5 } from 'js-md5'

export function hashPassword(plain: string): string {
  return md5(plain).toUpperCase()
}
