import {lerp} from './glutils.js'

export class Easing {
  static linear = x => x

  static easeOutQuint = x =>
    1 - Math.pow(1 - x, 5)
}

export default class animated {

  constructor (duration = 0.2, easing = Easing.linear) {
    this.duration = duration
    this.easing = easing
  }

  set(v) {
    if (typeof v === 'boolean') v = v ? 1 : 0
    if (this.toValue === undefined)
      return this.force(v)
    if (Math.abs(this.toValue - v) > 0.001) {
      this.fromValue = this.get()
      this.toValue = v
      this.startTime = animated.now()
    }
    return this.get()
  }

  force(v) {
    if (typeof v === 'boolean') v = v ? 1 : 0
    this.fromValue = v
    this.toValue = v
    this.startTime = animated.now() + this.duration
    return v
  }

  get() {
    let t = (animated.now() - this.startTime) / this.duration
    if (t > 1) return this.toValue
    return lerp(this.fromValue, this.toValue, this.easing(t))
  }

  static now() {
    return Date.now() / 1000.0
  }

}