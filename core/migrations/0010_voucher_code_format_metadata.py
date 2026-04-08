from django.db import migrations


def apply_code_formats(apps, schema_editor):
    VoucherCatalogItem = apps.get_model("core", "VoucherCatalogItem")

    provider_defaults = {
        "OTT Voucher": {"codeCharset": "alnum", "codeLength": 12, "codeGroupSize": 4, "codeSeparator": "-"},
        "1Voucher": {"codeCharset": "numeric", "codeLength": 12, "codeGroupSize": 4, "codeSeparator": "-"},
        "BluVoucher": {"codeCharset": "alnum", "codeLength": 10, "codeGroupSize": 5, "codeSeparator": "-"},
        "EasyPay Voucher": {"codeCharset": "numeric", "codeLength": 12, "codeGroupSize": 4, "codeSeparator": "-"},
        "EasyLoad Voucher": {"codeCharset": "numeric", "codeLength": 10, "codeGroupSize": 5, "codeSeparator": "-"},
        "Kazang Voucher": {"codeCharset": "numeric", "codeLength": 12, "codeGroupSize": 4, "codeSeparator": " "},
        "Ringas Voucher": {"codeCharset": "numeric", "codeLength": 10, "codeGroupSize": 5, "codeSeparator": "-"},
        "Pay@ Voucher": {"codeCharset": "numeric", "codeLength": 10, "codeGroupSize": 5, "codeSeparator": "-"},
        "aCoin Voucher": {"codeCharset": "alpha", "codeLength": 8, "codeGroupSize": 4, "codeSeparator": "-"},
        "Pearson VUE": {"codeCharset": "alnum", "codeLength": 12, "codeGroupSize": 4, "codeSeparator": "-"},
        "Certiport": {"codeCharset": "alnum", "codeLength": 10, "codeGroupSize": 5, "codeSeparator": "-"},
        "PSI": {"codeCharset": "alnum", "codeLength": 10, "codeGroupSize": 5, "codeSeparator": "-"},
        "MTN": {"codeCharset": "numeric", "codeLength": 12, "codeGroupSize": 4, "codeSeparator": " "},
        "Vodacom": {"codeCharset": "numeric", "codeLength": 12, "codeGroupSize": 4, "codeSeparator": " "},
        "Telkom": {"codeCharset": "numeric", "codeLength": 12, "codeGroupSize": 4, "codeSeparator": " "},
        "Cell C": {"codeCharset": "numeric", "codeLength": 12, "codeGroupSize": 4, "codeSeparator": " "},
        "Eskom": {"codeCharset": "numeric", "codeLength": 20, "codeGroupSize": 4, "codeSeparator": " "},
        "Municipal": {"codeCharset": "numeric", "codeLength": 20, "codeGroupSize": 4, "codeSeparator": " "},
    }

    category_defaults = {
        "retail": {"codeCharset": "numeric", "codeLength": 12, "codeGroupSize": 4, "codeSeparator": "-"},
        "food": {"codeCharset": "alnum", "codeLength": 10, "codeGroupSize": 5, "codeSeparator": "-"},
        "learning": {"codeCharset": "alnum", "codeLength": 12, "codeGroupSize": 4, "codeSeparator": "-"},
        "entertainment": {"codeCharset": "alnum", "codeLength": 12, "codeGroupSize": 4, "codeSeparator": "-"},
        "transport": {"codeCharset": "alnum", "codeLength": 10, "codeGroupSize": 5, "codeSeparator": "-"},
    }

    fallback = {"codeCharset": "alnum", "codeLength": 10, "codeGroupSize": 5, "codeSeparator": "-"}

    for item in VoucherCatalogItem.objects.all():
        metadata = dict(item.metadata or {})
        defaults = provider_defaults.get(item.provider) or category_defaults.get(item.category) or fallback
        metadata.update(defaults)
        item.metadata = metadata
        item.save(update_fields=["metadata", "updated_at"])


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0009_expand_voucher_catalog"),
    ]

    operations = [
        migrations.RunPython(apply_code_formats, migrations.RunPython.noop),
    ]
