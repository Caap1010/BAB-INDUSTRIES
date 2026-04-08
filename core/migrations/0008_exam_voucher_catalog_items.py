from decimal import Decimal

from django.db import migrations, models


def seed_exam_voucher_items(apps, schema_editor):
    VoucherCatalogItem = apps.get_model("core", "VoucherCatalogItem")
    items = [
        {
            "provider": "Microsoft",
            "name": "Microsoft Exam Voucher AZ-900",
            "category": "exam",
            "delivery_type": "digital_voucher",
            "face_value": Decimal("1500.00"),
            "sale_price": Decimal("1500.00"),
            "currency": "ZAR",
            "requires_recipient": True,
            "recipient_label": "Candidate email",
            "notes": "Microsoft certification exam voucher",
        },
        {
            "provider": "Cisco",
            "name": "Cisco Exam Voucher CCNA",
            "category": "exam",
            "delivery_type": "digital_voucher",
            "face_value": Decimal("6200.00"),
            "sale_price": Decimal("6200.00"),
            "currency": "ZAR",
            "requires_recipient": True,
            "recipient_label": "Candidate email",
            "notes": "Cisco certification exam voucher",
        },
        {
            "provider": "CompTIA",
            "name": "CompTIA Exam Voucher Security+",
            "category": "exam",
            "delivery_type": "digital_voucher",
            "face_value": Decimal("7500.00"),
            "sale_price": Decimal("7500.00"),
            "currency": "ZAR",
            "requires_recipient": True,
            "recipient_label": "Candidate email",
            "notes": "CompTIA certification exam voucher",
        },
    ]

    for item in items:
        VoucherCatalogItem.objects.update_or_create(
            provider=item["provider"],
            name=item["name"],
            defaults={**item, "metadata": {}},
        )


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0007_voucher_marketplace"),
    ]

    operations = [
        migrations.AlterField(
            model_name="vouchercatalogitem",
            name="category",
            field=models.CharField(
                choices=[
                    ("airtime", "Airtime"),
                    ("betting", "Betting"),
                    ("food", "Food"),
                    ("data", "Data"),
                    ("entertainment", "Entertainment"),
                    ("exam", "Exam"),
                    ("electricity", "Electricity"),
                    ("other", "Other"),
                ],
                default="other",
                max_length=24,
            ),
        ),
        migrations.RunPython(seed_exam_voucher_items, migrations.RunPython.noop),
    ]
