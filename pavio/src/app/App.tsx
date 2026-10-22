import { Footer } from '../components/common/Footer'
import { Logo } from '../components/common/Logo'
import styles from './App.module.css'

export function App() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Logo />
        <span className={styles.brand}>Pavio</span>
      </header>
      <main className={styles.main}>
        <p>O gráfico chega na etapa 1.</p>
      </main>
      <Footer />
    </div>
  )
}
