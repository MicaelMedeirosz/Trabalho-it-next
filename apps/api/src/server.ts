import { app } from "./app";
import { env } from "./config/env";
import { seedValidationRules } from "./modules/validation/validation.engine";

async function bootstrap() {
  await seedValidationRules();
  app.listen(env.port, () => {
    console.log(`API rodando na porta ${env.port}`);
  });
}

bootstrap().catch((err) => {
  console.error("Falha ao iniciar servidor:", err);
  process.exit(1);
});
