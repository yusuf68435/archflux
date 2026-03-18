import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kullanım Şartları",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      <div className="text-muted-foreground leading-7 space-y-2">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Kullanım Şartları</h1>
      <p className="text-sm text-muted-foreground mb-10">Son güncelleme: Mart 2026</p>

      <Section title="1. Hizmet Tanımı">
        <p>ArchFlux, mimari cephe fotoğraflarını yapay zeka kullanarak DXF formatında CAD çizimlerine dönüştüren bir web uygulamasıdır.</p>
      </Section>

      <Section title="2. Hesap Koşulları">
        <ul className="list-disc pl-5 space-y-1">
          <li>Hizmeti kullanmak için Google hesabıyla oturum açmanız gerekir.</li>
          <li>Hesabınızın güvenliğinden siz sorumlusunuz.</li>
          <li>Yanlış veya yanıltıcı bilgi sağlamak yasaktır.</li>
        </ul>
      </Section>

      <Section title="3. Kredi Sistemi">
        <ul className="list-disc pl-5 space-y-1">
          <li>Her dönüştürme işlemi belirli miktarda kredi tüketir.</li>
          <li>Satın alınan krediler iade edilmez; ancak teknik arıza durumunda kredi iadesi yapılabilir.</li>
          <li>İade talepleri yönetici tarafından değerlendirilir.</li>
        </ul>
      </Section>

      <Section title="4. Kabul Edilemez Kullanım">
        <p>Aşağıdaki kullanımlar yasaktır:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Sistemi otomatik araçlarla (bot, script) aşırı yüklemek</li>
          <li>Hizmetin güvenliğini tehdit edecek içerik yüklemek</li>
          <li>Başkalarına ait telif hakkıyla korunan içerikleri izinsiz işlemek</li>
          <li>Sistemin altyapısını kötüye kullanmak</li>
        </ul>
      </Section>

      <Section title="5. Yüklenen İçerik">
        <p>Yüklediğiniz fotoğrafların telif hakkı size aittir. ArchFlux, yüklenen içerikleri yalnızca dönüştürme hizmeti amacıyla kullanır; üçüncü taraflarla paylaşmaz.</p>
      </Section>

      <Section title="6. Çıktı Kalitesi">
        <p>DXF çıktıları yapay zeka tarafından üretilir ve hata içerebilir. ArchFlux, üretilen çizimlerin doğruluğunu garanti etmez. Çıktılar profesyonel incelemeye tabi tutulmalıdır.</p>
      </Section>

      <Section title="7. Hizmet Kesintisi">
        <p>ArchFlux bakım veya teknik nedenlerle geçici olarak erişilemez hale gelebilir. Bu durumlarda önceden bildirim yapılmaya çalışılır.</p>
      </Section>

      <Section title="8. Sorumluluk Sınırı">
        <p>ArchFlux, üretilen DXF dosyalarının kullanımından kaynaklanabilecek zararlardan sorumlu tutulamaz.</p>
      </Section>

      <Section title="9. Değişiklikler">
        <p>Bu şartlar önceden bildirim yapılmaksızın güncellenebilir. Güncellemeler uygulama içinde duyurulur.</p>
      </Section>
    </div>
  );
}
