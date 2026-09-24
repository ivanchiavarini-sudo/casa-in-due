import { signIn } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  return (
    <main className="simple-login-wrap">
      <section className="card simple-login-card">
        <p className="eyebrow">Solo noi due</p>
        <h1>Casa in due</h1>
        <p className="journey-lead">
          Un posto separato per contare le spese, dividere i compiti e affrontare con calma le questioni pratiche.
        </p>

        {params.error ? <div className="notice">{params.error}</div> : null}

        <form action={signIn} className="simple-login-form">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <button className="button" type="submit">Entra</button>
        </form>

        <p className="small muted">
          Usa le stesse credenziali personali già create per il Piccolo manuale.
        </p>
      </section>
    </main>
  );
}
