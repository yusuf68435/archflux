import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gizlilik Politikası",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      <div className="text-muted-foreground leading-7 space-y-2">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Gizlilik Politikası</h1>
      <p className="text-sm text-muted-foreground mb-10">Son güncelleme: Mart 2026</p>

      <Section title="1. Toplanan Veriler">
        <p>ArchFlux, hizmetlerimizi sunabilmek için aşağıdaki verileri toplar:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Hesap bilgileri:</strong> Google OAuth aracılığıyla elde edilen ad, e-posta adresi ve profil fotoğrafı.</li>
          <li><strong className="text-foreground">Yüklenen görseller:</strong> Dönüştürme için yüklediğiniz cephe fotoğrafları. Görseller işlendikten sonra güvenli depolama alanında saklanır.</li>
          <li><strong className="text-foreground">İşlem geçmişi:</strong> Dönüştürme işlemleri, oluşturulan DXF dosyaları ve kullanılan kredi miktarları.</li>
          <li><strong className="text-foreground">Ödeme bilgileri:</strong> Stripe aracılığıyla işlenen ödeme bilgileri. Kart numarası tarafımızda saklanmaz.</li>
        </ul>
      </Section>

      <Section title="2. Verilerin Kullanım Amacı">
        <p>Toplanan veriler yalnızca şu amaçlarla kullanılır:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Fotoğraftan DXF dönüştürme hizmetinin sunulması</li>
          <li>Kullanıcı hesabının ve kredi bakiyesinin yönetimi</li>
          <li>İşlem bildirimleri gönderilmesi (e-posta)</li>
          <li>Hizmet kalitesinin iyileştirilmesi</li>
        </ul>
      </Section>

      <Section title="3. Veri Paylaşımı">
        <p>Verileriniz üçüncü taraflarla pazarlama amacıyla paylaşılmaz. Hizmet sağlayıcılar (Google OAuth, Stripe, Resend) yalnızca ilgili işlev kapsamında verilerinize erişir.</p>
      </Section>

      <Section title="4. Veri Saklama Süresi">
        <p>Hesabınız aktif olduğu sürece verileriniz saklanır. Hesabınızı silmeniz durumunda verileriniz 30 gün içinde kalıcı olarak silinir.</p>
      </Section>

      <Section title="5. Güvenlik">
        <p>Tüm veriler HTTPS üzerinden şifreli olarak iletilir. Sunucular güvenlik duvarı koruması altındadır. Veritabanı erişimi kimlik doğrulama gerektirmektedir.</p>
      </Section>

      <Section title="6. Çerezler">
        <p>ArchFlux yalnızca oturum yönetimi için zorunlu çerezler kullanır. Reklam veya izleme çerezi kullanılmaz.</p>
      </Section>

      <Section title="7. Haklarınız">
        <p>Verilerinize erişim, düzeltme veya silme talebinde bulunabilirsiniz. Ayarlar sayfasından hesap silme seçeneğini kullanabilirsiniz.</p>
      </Section>

      <Section title="8. İletişim">
        <p>Gizlilik ile ilgili sorularınız için uygulama içi destek kanalını kullanabilirsiniz.</p>
      </Section>
    </div>
  );
}
