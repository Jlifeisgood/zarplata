import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Base64;

/**
 * Update signature (ECDSA P-256). The private key stays outside the repo, the public key is built into the apps (Updater.java, Updater.swift).
 *   java tools/SignUpdate.java gen  <private key file>                     prints the public key (Base64 DER)
 *   java tools/SignUpdate.java sign <private key file> <in file> <out file> writes the signature (Base64 DER)
 */
public class SignUpdate {
    public static void main(String[] a) throws Exception {
        if (a[0].equals("gen")) {
            Path key = Path.of(a[1]);
            if (Files.exists(key)) throw new IllegalStateException("Key already exists: " + key);
            KeyPairGenerator g = KeyPairGenerator.getInstance("EC");
            g.initialize(new ECGenParameterSpec("secp256r1"));
            KeyPair k = g.generateKeyPair();
            Files.write(key, k.getPrivate().getEncoded());
            System.out.println(Base64.getEncoder().encodeToString(k.getPublic().getEncoded()));
        } else if (a[0].equals("sign")) {
            PrivateKey p = KeyFactory.getInstance("EC").generatePrivate(new PKCS8EncodedKeySpec(Files.readAllBytes(Path.of(a[1]))));
            Signature s = Signature.getInstance("SHA256withECDSA");
            s.initSign(p);
            s.update(Files.readAllBytes(Path.of(a[2])));
            Files.writeString(Path.of(a[3]), Base64.getEncoder().encodeToString(s.sign()));
        } else throw new IllegalArgumentException(a[0]);
    }
}
