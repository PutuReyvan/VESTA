import logoMark from '../../assets/VESTALOGO.svg'

export function Logo() {
  return (
    <div className="logo" aria-label="Vesta">
      <img className="logo-mark" src={logoMark} alt="" />
      <span>VESTA</span>
    </div>
  )
}
