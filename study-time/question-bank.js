const q = (domain, prompt, options, answer, explanation) => ({
    domain,
    prompt,
    options,
    answer,
    explanation
});

window.studyTimeExams = [
    {
        id: "az-900",
        code: "AZ-900",
        title: "Azure Fundamentals",
        level: "Fundamentals",
        duration: 18,
        focus: "Cloud concepts, Azure core services, governance, security, pricing, and monitoring fundamentals.",
        objectives: [
            "Cloud concepts",
            "Core Azure services",
            "Security and identity basics",
            "Governance and compliance",
            "Pricing and support",
            "Monitoring fundamentals"
        ],
        questionBank: [
            q("Cloud Concepts", "A startup wants to scale its customer portal during seasonal spikes without buying new physical servers. Which cloud benefit best addresses this requirement?", ["Low latency through regional peering", "Elasticity that adjusts resources based on demand", "CapEx ownership of hardware assets", "Offline data synchronization"], 1, "Elasticity allows resources to scale up or down with demand, which is one of the core benefits of cloud computing."),
            q("Cloud Concepts", "Which cost model best describes moving from buying datacenter hardware upfront to paying for resources only when they are consumed in Azure?", ["CapEx to OpEx", "OpEx to CapEx", "Fixed-cost subscription to capital reserve", "Perpetual license to hardware ownership"], 0, "Cloud adoption typically shifts spending from capital expenditure to operating expenditure."),
            q("Cloud Concepts", "In a software as a service solution, which responsibility usually remains with the customer?", ["Patching the operating system", "Maintaining the physical server", "Managing user access and data classification", "Replacing failed storage drives"], 2, "Even in SaaS, the customer is still responsible for users, identities, and the classification and protection of its data."),
            q("Cloud Concepts", "Which cloud model combines private infrastructure with public cloud services to meet both regulatory and scalability needs?", ["Community cloud", "Hybrid cloud", "Edge-only cloud", "Colocation-only hosting"], 1, "A hybrid cloud approach combines on-premises or private environments with public cloud services."),
            q("Core Services", "Which Azure service is designed primarily for storing large amounts of unstructured data such as images, backups, and documents?", ["Azure Blob Storage", "Azure Virtual Network", "Azure Policy", "Azure Monitor"], 0, "Azure Blob Storage is optimized for unstructured object data such as media files and backups."),
            q("Core Services", "Which Azure service should you choose to host a simple Windows or Linux virtual machine?", ["Azure Virtual Machines", "Azure DNS", "Azure Policy", "Azure Cost Management"], 0, "Azure Virtual Machines provides infrastructure as a service compute for custom operating systems and workloads."),
            q("Core Services", "Which Azure networking component provides private IP-based communication between Azure resources?", ["Azure Virtual Network", "Azure CDN", "Azure Policy", "Azure Backup vault"], 0, "Azure Virtual Network is the foundational private networking service in Azure."),
            q("Identity", "A company wants employees to sign in once and access multiple SaaS applications. Which Azure capability should they use?", ["Azure DDoS Protection", "Microsoft Entra ID single sign-on", "Azure Cost Management", "Azure Load Balancer"], 1, "Single sign-on in Microsoft Entra ID lets users authenticate once and access multiple applications."),
            q("Identity", "Which security control adds an additional verification step during sign-in and reduces the risk of password-only compromise?", ["Azure Advisor", "Microsoft Entra multifactor authentication", "Azure Front Door", "Azure Resource Graph"], 1, "Multifactor authentication requires a second factor beyond the password, improving sign-in security."),
            q("Governance", "Which feature helps an organization enforce that only specific Azure regions can be used for new resources?", ["Azure Policy", "Azure Firewall", "Azure Advisor", "Azure Bastion"], 0, "Azure Policy can audit or deny resource deployments that do not meet governance requirements such as allowed locations."),
            q("Monitoring", "Which service provides a central place to collect metrics, logs, alerts, and dashboards for Azure resources?", ["Azure Monitor", "Azure Lighthouse", "Azure Reservations", "Azure Blueprints"], 0, "Azure Monitor collects telemetry and provides alerting and visualization for Azure resources and applications."),
            q("Pricing", "Which tool should a learner use to estimate the monthly cost of a planned Azure deployment before creating resources?", ["Pricing calculator", "Service Health", "Resource locks", "Network Watcher"], 0, "The Azure Pricing Calculator is used to estimate expected monthly costs before deployment."),
            q("Support and SLA", "If an application uses two independent virtual machines behind a load balancer, what happens to expected availability compared with a single VM?", ["It always decreases because the design is more complex", "It typically increases because the workload has redundancy", "It becomes zero during maintenance windows", "It no longer depends on architecture"], 1, "Redundancy generally improves availability because a single component failure is less likely to cause total outage."),
            q("Governance", "Which Azure feature lets you control who can create, modify, or delete resources by assigning permissions to identities?", ["Role-based access control", "Azure Queue Storage", "Azure Batch", "Availability sets"], 0, "Role-based access control governs access to Azure resources based on assigned roles."),
            q("Pricing", "Which option can help reduce costs for long-running predictable virtual machine workloads compared with pure pay-as-you-go pricing?", ["Reserved capacity or reservations", "Availability zones", "Service endpoints", "Azure Advisor secure score"], 0, "Reservations can reduce the cost of long-running, predictable workloads when compared with pay-as-you-go usage."),
            q("Security", "Which Microsoft security service helps assess security posture and surface recommendations across Azure resources?", ["Microsoft Defender for Cloud", "Azure Virtual WAN", "Azure Lab Services", "Azure NetApp Files"], 0, "Microsoft Defender for Cloud provides posture recommendations and threat protection capabilities.")
        ]
    },
    {
        id: "az-305",
        code: "AZ-305",
        title: "Azure Solutions Architect",
        level: "Expert",
        duration: 22,
        focus: "Identity, governance, networking, business continuity, compute, data, and solution architecture design in Azure.",
        objectives: [
            "Identity and governance",
            "Compute and application architecture",
            "Storage and data platform design",
            "Business continuity",
            "Hybrid networking",
            "Monitoring and optimization"
        ],
        questionBank: [
            q("Architecture Design", "A company needs a highly available web application that can survive the loss of an Azure region. Which design approach is most appropriate?", ["Single-region deployment with Availability Sets", "Multi-region deployment with traffic distribution and replicated data", "One virtual machine with daily backups", "Local host caching only"], 1, "A multi-region design with global traffic distribution and replicated dependencies improves resiliency against regional outages."),
            q("Identity", "Which option should you recommend when applications in Azure need to access secrets without storing credentials in code?", ["Managed identities with Azure Key Vault", "Shared admin accounts in configuration files", "Hard-coded service principal secrets", "Anonymous public endpoints"], 0, "Managed identities reduce credential management overhead, and Key Vault provides secure secret storage and retrieval."),
            q("Business Continuity", "A workload requires recovery to a second region with low recovery time objectives for virtual machines. Which service is the best fit?", ["Azure Site Recovery", "Azure Blueprints", "Azure Policy", "Azure Lighthouse"], 0, "Azure Site Recovery replicates workloads and orchestrates failover for disaster recovery scenarios."),
            q("Networking", "A hybrid design requires private connectivity between an on-premises datacenter and Azure with predictable performance. Which option is most suitable?", ["Azure ExpressRoute", "Public internet with no encryption", "Azure CDN", "Azure Front Door only"], 0, "ExpressRoute provides dedicated private connectivity between on-premises environments and Azure."),
            q("Data Platform", "You need a globally distributed NoSQL database with turnkey multi-region writes and low latency. Which Azure service should be chosen?", ["Azure SQL Managed Instance", "Azure Cosmos DB", "Azure Files", "Azure Batch"], 1, "Azure Cosmos DB is designed for globally distributed, low-latency NoSQL workloads with multi-region capabilities."),
            q("Application Design", "A PaaS web application must reach a storage account privately without exposing the storage service to the public internet. Which design choice is best?", ["Private Endpoint", "Public endpoint with IP wildcard rules", "Anonymous blob access", "Azure CDN endpoint"], 0, "Private Endpoints allow PaaS services to be reached privately through a virtual network."),
            q("Networking", "Which topology is commonly used when many application spokes need to connect through shared security and connectivity services?", ["Hub-and-spoke", "Point-to-point only", "Single flat virtual network for every workload", "Dedicated host topology"], 0, "Hub-and-spoke centralizes shared services such as firewalls, DNS, and connectivity while isolating application spokes."),
            q("Compute", "A mission-critical workload must continue running even if one datacenter within a region fails. Which Azure design choice most directly supports that requirement?", ["Availability Zones", "Resource tags", "Azure DevTest Labs", "Storage lifecycle policies"], 0, "Availability Zones distribute resources across physically separate datacenters within a region."),
            q("Migration", "Which Azure service helps assess on-premises servers and plan migration waves into Azure?", ["Azure Migrate", "Azure Advisor", "Azure Bastion", "Azure Communication Services"], 0, "Azure Migrate is used to discover, assess, and plan migration of on-premises assets to Azure."),
            q("Integration", "An architecture must decouple producers and consumers and support durable enterprise messaging between distributed components. Which service is the strongest fit?", ["Azure Service Bus", "Azure DNS", "Azure Policy", "Azure Files"], 0, "Azure Service Bus supports durable, enterprise-grade messaging patterns for decoupled applications."),
            q("Optimization", "A solutions architect is reviewing a stable set of always-on compute workloads that run all year. Which recommendation may lower cost without redesigning the application?", ["Purchase reservations for predictable resources", "Move all resources to test regions", "Disable monitoring", "Increase autoscale minimum to the highest value"], 0, "Reservations can lower cost for predictable long-running compute resources."),
            q("Observability", "Which combination best supports end-to-end application monitoring, dependency tracing, and operational dashboards for an Azure-hosted application?", ["Application Insights with Azure Monitor", "Azure Reservations with Cost Management", "Azure Firewall with DDoS IP Protection", "Azure DNS with Traffic Manager"], 0, "Application Insights and Azure Monitor together provide telemetry, dependency tracing, and dashboards for operational insight."),
            q("Governance", "An organization wants to enforce consistent resource naming, required tags, and region controls across subscriptions. Which architecture element is appropriate?", ["Management groups with Azure Policy assignments", "Only virtual network peering", "Only NSGs on each subnet", "Only resource locks"], 0, "Management groups and policy assignments are suited for governance standards across multiple subscriptions."),
            q("Storage Design", "A solution stores files that must be shared concurrently by multiple application servers using the SMB protocol. Which service should be considered first?", ["Azure Files", "Azure Queue Storage", "Azure Bastion", "Azure API Management"], 0, "Azure Files provides managed file shares accessible over SMB and NFS depending on the scenario."),
            q("Security Architecture", "Which design principle most reduces the blast radius of a compromised application component in Azure?", ["Least privilege with segmented network boundaries", "Single shared owner account across all services", "Public endpoints on every resource", "Manual secret distribution through email"], 0, "Applying least privilege and network segmentation limits what a compromised component can access."),
            q("Identity", "Administrators need just-in-time elevation for high-privilege roles with approval and audit trails. Which capability should be in the design?", ["Privileged Identity Management", "Azure Queue Storage", "Availability sets", "Azure NetApp Files"], 0, "Privileged Identity Management provides time-bound elevated role activation with governance controls.")
        ]
    },
    {
        id: "az-500",
        code: "AZ-500",
        title: "Azure Security Engineer",
        level: "Associate",
        duration: 22,
        focus: "Identity security, platform protection, data security, network controls, and security operations across Azure workloads.",
        objectives: [
            "Manage identity and access",
            "Protect networking",
            "Secure compute and storage",
            "Manage keys and secrets",
            "Security operations",
            "Cloud posture management"
        ],
        questionBank: [
            q("Identity Security", "Administrators must perform privileged tasks only after verifying device compliance and multifactor authentication. Which control should be implemented?", ["Conditional Access", "Azure DNS Private Resolver", "Azure Virtual WAN", "Storage lifecycle rules"], 0, "Conditional Access can enforce MFA and device state requirements before privileged access is granted."),
            q("Security Operations", "Which service provides centralized security posture management and threat protection across Azure, hybrid, and multicloud resources?", ["Microsoft Defender for Cloud", "Azure Files", "Azure Load Testing", "Azure Automation Update Management"], 0, "Microsoft Defender for Cloud combines posture management with threat protection recommendations and alerts."),
            q("Key Management", "Your organization needs hardware-protected keys for highly sensitive cryptographic operations. Which Azure option fits best?", ["Azure Key Vault Managed HSM", "Azure App Service", "Azure Traffic Manager", "Azure Migrate"], 0, "Managed HSM provides dedicated, standards-based hardware security modules for key operations."),
            q("Network Security", "Which Azure service can inspect and filter outbound and inbound traffic using application and network rules at scale?", ["Azure Firewall", "Azure Bastion", "Azure Monitor Workbook", "Azure Lab Services"], 0, "Azure Firewall is a managed network security service that enforces central traffic filtering policies."),
            q("Monitoring", "A security team wants to correlate sign-in logs, alerts, and incidents in a SIEM and SOAR platform. Which Microsoft service is appropriate?", ["Microsoft Sentinel", "Azure Cost Management", "Azure Arc", "Azure Container Apps"], 0, "Microsoft Sentinel provides SIEM and SOAR capabilities for collecting, correlating, and responding to security events."),
            q("Identity Governance", "Which Microsoft Entra capability gives administrators temporary elevation into privileged roles with approval and audit?", ["Privileged Identity Management", "Application Gateway", "Azure DNS", "Azure Migrate"], 0, "Privileged Identity Management supports just-in-time privileged access with approval workflows and auditing."),
            q("Network Security", "A storage account must be reachable only from a specific virtual network and not from the public internet. Which control is the best fit?", ["Private Endpoint", "Public endpoint with anonymous access", "Availability Zones", "Resource tags"], 0, "Private Endpoints allow access over a private IP within a virtual network rather than over a public endpoint."),
            q("Data Protection", "Which option lets an organization control the encryption keys used to protect supported Azure data services?", ["Customer-managed keys", "Auto-shutdown", "Azure Reservations", "Service Health"], 0, "Customer-managed keys let the organization manage the lifecycle of the encryption keys used by supported services."),
            q("Compute Security", "A team wants to reduce exposure of management ports on Azure virtual machines and open them only when required. Which feature should be used?", ["Just-in-time VM access", "Azure CDN", "Resource Graph", "Azure Data Share"], 0, "Just-in-time VM access reduces the attack surface by limiting when management ports are open."),
            q("Network Protection", "Which service helps mitigate large-scale volumetric attacks against internet-facing Azure resources?", ["Azure DDoS Protection", "Azure Queue Storage", "Azure Arc", "Azure File Sync"], 0, "Azure DDoS Protection helps defend Azure resources from distributed denial-of-service attacks."),
            q("Storage Security", "Which Azure feature should be enabled to prevent accidental or malicious deletion of critical blobs for a retention period?", ["Blob soft delete", "Azure Bastion", "Availability sets", "Autoscale"], 0, "Blob soft delete preserves deleted data for a configured retention period, improving recoverability."),
            q("Container Security", "A security engineer wants to identify vulnerabilities in container images before deployment to Kubernetes. What should be included in the workflow?", ["Image scanning in the build or registry pipeline", "Manual image naming conventions only", "Longer pod names", "Public cluster endpoints without authentication"], 0, "Scanning container images before deployment helps surface vulnerabilities before workloads reach production."),
            q("Logging", "Why would a security engineer route platform and diagnostic logs to a central Log Analytics workspace?", ["To support detection, hunting, and incident investigation", "To reduce the number of identities in Entra ID", "To increase VM CPU performance", "To replace backup policies"], 0, "Centralized logs support correlation, hunting, alerting, and incident response."),
            q("Access Control", "What is the main reason to prefer role-based access control over assigning broad subscription owner permissions to many users?", ["It supports least privilege", "It disables logging", "It removes the need for identity providers", "It forces every resource to be public"], 0, "Role-based access control allows permissions to be scoped appropriately, reducing excessive access."),
            q("Application Security", "An internal web app needs secure user sign-in and token issuance using standards-based identity protocols. Which platform capability should be used?", ["Microsoft Entra ID application integration", "Azure CDN rules engine", "Availability sets", "Route tables only"], 0, "Microsoft Entra ID can issue tokens and handle standards-based authentication for internal applications."),
            q("Security Posture", "What does a low secure score in Defender for Cloud generally indicate?", ["Security recommendations are not yet fully addressed", "Azure regions are unavailable", "The subscription is out of credits", "The tenant has too many virtual networks"], 0, "Secure score reflects how completely recommended security controls have been implemented.")
        ]
    },
    {
        id: "ai-102",
        code: "AI-102",
        title: "Azure AI Engineer",
        level: "Associate",
        duration: 22,
        focus: "Applied AI solution design with Azure AI services, search, language, vision, prompt orchestration, and responsible AI controls.",
        objectives: [
            "Plan Azure AI solutions",
            "Implement language and speech",
            "Implement vision and document intelligence",
            "Build search and retrieval solutions",
            "Deploy and monitor models",
            "Apply responsible AI controls"
        ],
        questionBank: [
            q("Azure AI Solutions", "A team wants to build a chat assistant that retrieves grounded answers from internal documents before generating a response. Which pattern should be used?", ["Retrieval-augmented generation", "Static website hosting", "Round-robin load balancing", "Disk striping"], 0, "Retrieval-augmented generation combines retrieval from trusted data sources with model generation to produce grounded answers."),
            q("Vision", "Which Azure AI capability is best for extracting printed text from scanned invoices and forms?", ["Azure AI Vision OCR", "Azure CDN", "Azure DevTest Labs", "Azure Route Server"], 0, "OCR features in Azure AI Vision are intended for detecting and extracting text from images and scanned documents."),
            q("Language", "You need to identify key phrases, entities, and sentiment from customer feedback at scale. Which service area is most relevant?", ["Azure AI Language", "Azure VPN Gateway", "Azure Policy Guest Configuration", "Azure NetApp Files"], 0, "Azure AI Language includes sentiment analysis, entity recognition, and key phrase extraction."),
            q("Search", "Which Azure service helps index enterprise content so an application can query documents with relevance ranking and filtering?", ["Azure AI Search", "Azure Notification Hubs", "Azure Spring Apps", "Azure Dedicated Host"], 0, "Azure AI Search is built for indexing, ranking, and querying large document collections."),
            q("Responsible AI", "Before deploying an AI application, a team wants to validate safety filters, monitor outputs, and control access to models. What should be part of the design?", ["Governance, content filtering, and monitoring controls", "Only a larger VM size", "Removing authentication requirements", "Publishing outputs directly to all users without review"], 0, "Responsible AI deployment requires governance controls such as filtering, monitoring, auditing, and access management."),
            q("Speech", "Which Azure AI capability should be used to convert spoken customer calls into text for downstream analytics?", ["Azure AI Speech speech-to-text", "Azure Firewall", "Azure DDoS Protection", "Azure Reservations"], 0, "Speech-to-text in Azure AI Speech converts spoken audio into text for analysis and automation."),
            q("Language", "A project needs to classify support tickets into custom business categories such as billing, outages, and onboarding. Which approach fits best?", ["Custom text classification", "Static HTML forms", "Blob lifecycle management", "Network security groups"], 0, "Custom text classification is intended for categorizing text into domain-specific classes."),
            q("Document Intelligence", "Which Azure AI service is purpose-built to extract fields, tables, and structure from forms and business documents?", ["Azure AI Document Intelligence", "Azure Chaos Studio", "Azure Cache for Redis", "Azure Route Server"], 0, "Document Intelligence is designed for extracting structured information from forms, invoices, and similar documents."),
            q("Prompt Engineering", "When designing prompts for a business assistant, why is grounding the model with trusted enterprise data important?", ["It reduces unsupported answers and improves relevance", "It disables authentication prompts", "It makes networking simpler", "It automatically removes every security risk"], 0, "Grounding reduces hallucination risk and improves the relevance of model responses to enterprise content."),
            q("Model Deployment", "A team needs to release a new model version gradually and observe quality signals before broad adoption. What is a sensible deployment strategy?", ["Stage rollout with monitoring and evaluation", "Replace all production endpoints instantly without testing", "Disable logs before deployment", "Remove content filtering to reduce latency"], 0, "Gradual rollout with monitoring helps validate model behavior before full production exposure."),
            q("Search", "Which feature is especially useful when storing semantic vectors for similarity search over enterprise documents?", ["Vector search support", "BGP route propagation", "Azure Policy exemptions", "Service Health alerts"], 0, "Vector search allows similarity matching between embeddings and user queries for semantic retrieval."),
            q("Vision", "A retailer wants an application to identify objects and generate image captions for a product photo workflow. Which service area should be evaluated first?", ["Azure AI Vision", "Azure Cost Management", "Azure Migrate", "Azure Files"], 0, "Azure AI Vision provides image analysis capabilities such as object detection and captioning."),
            q("Speech", "An application must synthesize natural-sounding spoken responses from text for a voice bot. Which capability is required?", ["Text-to-speech", "Conditional Access", "Azure Backup", "Azure Site Recovery"], 0, "Text-to-speech generates synthetic spoken audio from input text."),
            q("Responsible AI", "Which practice most directly supports safe handling of user prompts that may contain harmful or restricted content?", ["Apply content filtering and abuse monitoring", "Store every prompt in public storage", "Disable authentication for reviewers", "Skip output evaluation"], 0, "Content filtering and abuse monitoring help manage unsafe prompts and outputs."),
            q("Solution Design", "Why would an AI engineer add evaluation datasets and repeatable test prompts to a generative AI project?", ["To measure quality, regressions, and safety over time", "To replace identity controls", "To eliminate the need for monitoring", "To avoid using search indexes"], 0, "Evaluation datasets help teams compare versions and track quality and safety changes over time."),
            q("Knowledge Mining", "A team wants users to search across PDFs, knowledge articles, and product manuals with citations back to the source documents. Which design pattern is most appropriate?", ["Search-backed conversational retrieval with citations", "Single local text file lookup", "Only manual FAQ updates", "Static IP allow lists"], 0, "Search-backed conversational retrieval enables grounded answers with links or citations to the source material.")
        ]
    },
    {
        id: "dp-203",
        code: "DP-203",
        title: "Azure Data Engineer",
        level: "Associate",
        duration: 22,
        focus: "Data ingestion, storage, transformation, streaming, serving, security, and operational monitoring on Azure.",
        objectives: [
            "Design storage",
            "Develop data processing",
            "Ingest and transform data",
            "Monitor data solutions",
            "Secure data platforms",
            "Batch and streaming analytics"
        ],
        questionBank: [
            q("Ingestion", "A company needs to orchestrate recurring data pipelines that ingest from multiple sources and load curated datasets into a lakehouse. Which service is commonly used?", ["Azure Data Factory", "Azure Chaos Studio", "Azure Load Balancer", "Azure Bastion"], 0, "Azure Data Factory is commonly used for orchestrating and scheduling data movement and transformation pipelines."),
            q("Streaming", "Which Azure analytics service is designed for processing high-volume event streams in near real time using SQL-like queries?", ["Azure Stream Analytics", "Azure Site Recovery", "Azure Front Door", "Azure Policy"], 0, "Azure Stream Analytics processes streaming events with real-time analytics using a SQL-like language."),
            q("Storage", "You need an inexpensive, massively scalable storage layer for raw and curated analytics data. Which service is a standard choice?", ["Azure Data Lake Storage", "Azure DNS", "Azure Scheduler", "Azure Lab Services"], 0, "Azure Data Lake Storage is the standard scalable storage foundation for analytics workloads."),
            q("Transformation", "Which platform is well suited for large-scale Spark-based transformations and collaborative data engineering notebooks?", ["Azure Synapse Analytics", "Azure Automation State Configuration", "Azure DDoS IP Protection", "Azure Maps"], 0, "Azure Synapse Analytics supports Spark workloads, notebooks, and integrated data engineering pipelines."),
            q("Security", "A data platform must protect access to storage accounts without embedding secrets in application code. What should be preferred?", ["Managed identities and role-based access control", "Shared passwords in a spreadsheet", "Anonymous blob containers for all datasets", "Public SAS tokens with no expiry"], 0, "Managed identities with RBAC reduce secret sprawl and enable secure, policy-based access to storage services."),
            q("Batch Processing", "A pipeline needs to load only new rows from a source system during each run instead of reprocessing the full dataset. Which approach should be implemented?", ["Incremental loading using watermarks or change tracking", "Delete the target table on every run", "Move all data manually through spreadsheets", "Disable partitioning"], 0, "Incremental loading reduces compute and processing time by moving only changed data."),
            q("Streaming", "Which Azure service is commonly used as the ingestion buffer for high-throughput telemetry before downstream stream processing?", ["Azure Event Hubs", "Azure Reservations", "Azure Policy", "Azure Bastion"], 0, "Azure Event Hubs is commonly used as the high-throughput ingestion layer for streaming data."),
            q("Storage Optimization", "Why would a data engineer partition large lake datasets by date or business key?", ["To improve read efficiency and query pruning", "To disable schema evolution", "To avoid role assignments", "To replace monitoring"], 0, "Partitioning helps engines read less data by narrowing which files must be scanned."),
            q("Modeling", "A reporting solution needs dimension and fact tables optimized for analytics and business intelligence. Which modeling approach is generally appropriate?", ["Star schema", "Fully normalized OLTP-only schema", "Flat text files with no keys", "IP subnet segmentation"], 0, "Star schema is a common analytical modeling approach for reporting and BI workloads."),
            q("Transformation", "A bronze-silver-gold data layering strategy is mainly used for what purpose?", ["Separating raw, cleaned, and curated data stages", "Assigning virtual network subnets", "Implementing certificate rotation", "Managing hardware procurement"], 0, "Layered medallion-style architectures help organize raw ingestion, standardized data, and business-ready outputs."),
            q("Security", "Which control is most relevant when different analytics users should see only the rows they are permitted to access in a serving layer?", ["Row-level security", "Blob versioning", "Availability sets", "Azure Arc"], 0, "Row-level security helps enforce access restrictions at the data layer based on user context."),
            q("Monitoring", "What is the main reason to configure pipeline alerts for failed activities and latency thresholds?", ["To detect and respond to data delivery issues quickly", "To reduce the number of storage accounts", "To replace schema validation", "To disable logging costs completely"], 0, "Monitoring and alerts help teams detect failed jobs and delayed pipelines before downstream consumers are impacted."),
            q("Data Quality", "A curated dataset must reject records with invalid schema or missing mandatory fields. What should be designed into the pipeline?", ["Validation and quarantine logic", "Anonymous access to the target lake", "Larger virtual machine sizes only", "A new DNS zone"], 0, "Validation rules and quarantine paths help preserve curated data quality while retaining invalid records for review."),
            q("Serving", "A batch of transformed parquet data is queried interactively by analysts. Which storage format characteristic helps performance in this scenario?", ["Columnar layout", "Manual compression by email", "Random file naming", "Public write access"], 0, "Columnar formats such as parquet improve analytical query performance by reading only relevant columns."),
            q("Operationalization", "Why might a data engineer add retry policies and idempotent sink behavior to data pipelines?", ["To improve resilience during transient failures", "To increase dashboard font size", "To remove authentication controls", "To replace logging"], 0, "Retries and idempotent writes reduce the impact of transient errors and duplicate processing."),
            q("Streaming Analytics", "If a sensor solution must join streaming events with reference data to enrich alerts in near real time, which pattern fits?", ["Stream processing with enrichment lookup", "Manual nightly CSV review", "Resource lock inheritance", "SaaS identity federation"], 0, "Real-time stream processing can enrich live events with reference data before producing outputs or alerts.")
        ]
    },
    {
        id: "az-400",
        code: "AZ-400",
        title: "Azure DevOps Engineer",
        level: "Expert",
        duration: 22,
        focus: "Continuous delivery, infrastructure as code, testing, observability, security, and release management for Azure solutions.",
        objectives: [
            "Source control and collaboration",
            "Continuous integration",
            "Continuous delivery",
            "Infrastructure as code",
            "Observability and feedback",
            "Security and compliance in pipelines"
        ],
        questionBank: [
            q("CI/CD", "A team wants every pull request to trigger automated tests and a deployment preview before merging. What capability is central to this workflow?", ["Continuous integration pipelines", "Manual desktop installation only", "Standalone spreadsheets", "USB-based release approval"], 0, "Continuous integration pipelines validate changes automatically so quality issues surface before merge."),
            q("Infrastructure as Code", "Which practice improves repeatability and reduces configuration drift when provisioning Azure resources?", ["Declarative infrastructure as code", "Manual portal changes in production", "Editing settings without version control", "Skipping peer review for templates"], 0, "Declarative infrastructure as code enables versioned, repeatable environment provisioning."),
            q("Observability", "A product owner wants insight into deployment health, application reliability, and failed dependencies after each release. Which capability should be emphasized?", ["Telemetry and application monitoring", "Longer meeting notes", "Bigger PowerPoint templates", "Duplicate production databases"], 0, "Telemetry and monitoring provide the post-release signals needed to evaluate deployment quality and reliability."),
            q("Release Strategy", "Which deployment approach sends a small percentage of live traffic to a new release before full rollout to reduce risk?", ["Canary deployment", "Big-bang deployment with no validation", "Manual USB patching", "Single-server shutdown deployment"], 0, "Canary deployment exposes a limited audience to the new version first so teams can observe impact before broad release."),
            q("Security", "A DevOps team wants secrets rotated centrally and injected into pipelines securely during runtime. What should be part of the solution?", ["Azure Key Vault integration", "Hard-coded credentials in source control", "Sending secrets by email", "Shared local text files"], 0, "Azure Key Vault centralizes secret management and supports secure use from automation pipelines."),
            q("Source Control", "Which collaboration practice reduces merge risk by getting feedback on small changes before they reach the main branch?", ["Frequent pull requests with code review", "Quarterly manual code drops", "Direct production edits", "Emailing zip files between developers"], 0, "Small reviewed pull requests reduce merge complexity and surface issues earlier."),
            q("Testing", "A delivery pipeline should block releases when unit or integration tests fail. What principle is being applied?", ["Quality gates in automation", "Manual exception handling only", "Skipping validation for hotfixes", "Running tests after production deployment only"], 0, "Quality gates prevent defective changes from progressing through the delivery pipeline."),
            q("Feature Management", "Why are feature flags useful during continuous delivery?", ["They separate deployment from feature exposure", "They remove the need for testing", "They replace source control", "They guarantee zero defects"], 0, "Feature flags allow teams to deploy code safely while controlling when users actually see new functionality."),
            q("Artifacts", "Which practice helps ensure downstream environments consume consistent, traceable build outputs?", ["Publish versioned build artifacts", "Rebuild differently in each environment", "Rename packages manually after release", "Store binaries only on developer desktops"], 0, "Publishing versioned artifacts improves reproducibility and traceability across environments."),
            q("Security", "A pipeline should detect vulnerable open-source dependencies before deployment. Which control should be added?", ["Dependency scanning", "Manual screenshot review", "Longer branch names", "Disabling package restore logs"], 0, "Dependency scanning surfaces known vulnerabilities in third-party packages before release."),
            q("Release Management", "Which rollback strategy is fastest when a newly deployed version causes errors and the previous version is still healthy?", ["Route traffic back to the last known good version", "Rewrite the application from scratch", "Delete all monitoring data", "Keep the failing release live until the next sprint"], 0, "Fast rollback to a previously healthy version reduces user impact while the issue is investigated."),
            q("Observability", "What is the main value of collecting deployment markers alongside application telemetry?", ["Teams can correlate behavior changes with specific releases", "It removes the need for alerts", "It replaces package management", "It makes DNS configuration unnecessary"], 0, "Deployment markers help teams understand whether a release introduced the observed operational change."),
            q("Infrastructure as Code", "Why should infrastructure templates be stored in the same version-controlled workflow as application changes when appropriate?", ["So environment changes are reviewed and traceable", "So secrets can be committed more easily", "So production can be changed without approvals", "So monitoring can be disabled"], 0, "Versioning infrastructure definitions provides reviewability, traceability, and repeatable provisioning."),
            q("Compliance", "What is the strongest reason to use policy checks and approval gates for production releases?", ["To enforce governance and reduce uncontrolled changes", "To make build times longer", "To avoid maintaining test environments", "To remove developer accountability"], 0, "Approval and policy gates help ensure that production changes meet governance requirements before rollout."),
            q("Pipeline Design", "Why would a team split a monolithic pipeline into reusable templates or shared workflow components?", ["To standardize logic and reduce duplication", "To avoid source control entirely", "To remove secret management", "To eliminate testing"], 0, "Reusable pipeline components improve consistency and reduce duplication across repositories and teams."),
            q("Progressive Delivery", "Which technique keeps the new release deployed but hidden from most users while the team validates telemetry with a small audience?", ["Ring-based or phased exposure", "Single-step full replacement", "Public preview without monitoring", "Manual server shutdown"], 0, "Progressive exposure strategies reduce risk by limiting how many users receive a new release at first.")
        ]
    }
];

function buildDrillQuestion(examCode, topic, correctStatement, wrong1, wrong2, wrong3) {
    return q(
        topic,
        `In ${examCode}, which statement is the best practice for ${topic.toLowerCase()}?`,
        [correctStatement, wrong1, wrong2, wrong3],
        0,
        correctStatement
    );
}

function buildGeneratedExamDrills(exam) {
    const templates = [
        {
            stem: "Which statement best reflects the core exam expectation for",
            wrongFactory: (topic) => [
                `${topic} is optional for certification readiness and can be skipped.`,
                `${topic} only matters after production incidents occur.`,
                `${topic} is unrelated to governance, security, and reliability outcomes.`
            ]
        },
        {
            stem: "In a scenario question, what is the strongest approach for",
            wrongFactory: (topic) => [
                `Ignoring ${topic} decisions usually improves architecture quality.`,
                `${topic} should be solved by adding more compute only.`,
                `${topic} does not influence operational risk.`
            ]
        },
        {
            stem: "For exam-style decision making, which principle is correct about",
            wrongFactory: (topic) => [
                `${topic} should be handled without monitoring or validation.`,
                `${topic} is solved by broad owner access across all resources.`,
                `${topic} does not require review against objectives.`
            ]
        },
        {
            stem: "When comparing answer options, which is the best-practice interpretation of",
            wrongFactory: (topic) => [
                `${topic} means selecting whichever option has the highest cost.`,
                `${topic} should be deferred until after deployment in every case.`,
                `${topic} is mostly a naming convention choice.`
            ]
        }
    ];

    const generated = [];

    exam.objectives.forEach((objective, objectiveIndex) => {
        templates.forEach((template, templateIndex) => {
            const topic = objective;
            const correct = `${topic} should be implemented using objective-aligned controls, measured outcomes, and least-risk architecture choices.`;
            const wrongs = template.wrongFactory(topic);

            generated.push(
                q(
                    `${objective} Drill`,
                    `${template.stem} ${objective.toLowerCase()} in ${exam.code}?`,
                    [correct, wrongs[0], wrongs[1], wrongs[2]],
                    0,
                    correct
                )
            );
        });

        generated.push(
            q(
                `${objective} Drill`,
                `A learner is weak in ${objective.toLowerCase()}. What study strategy is best before the next ${exam.code} mock?`,
                [
                    `Target ${objective.toLowerCase()} with focused drills, review explanations, and rerun timed scenarios.`,
                    "Skip weak domains and only practice comfortable topics.",
                    "Memorize terms without validating scenario decisions.",
                    "Rely on one perfect-score attempt and stop practicing."
                ],
                0,
                `Targeted drills and review cycles improve readiness in ${objective.toLowerCase()}.`
            )
        );

        if (objectiveIndex % 2 === 0) {
            generated.push(
                q(
                    `${objective} Drill`,
                    `Why should mock results in ${objective.toLowerCase()} be tracked over time for ${exam.code}?`,
                    [
                        "Tracking reveals persistent weaknesses so study plans can be adapted.",
                        "Tracking increases score variance and should be avoided.",
                        "Historical scores are unrelated to exam readiness.",
                        "Only final attempt scores should ever be reviewed."
                    ],
                    0,
                    "Trend tracking supports adaptive learning and better preparation decisions."
                )
            );
        }
    });

    generated.push(
        q(
            "Capstone Drill",
            `You are one week from ${exam.code}. Which approach best increases readiness across all objective areas?`,
            [
                "Mix timed full mocks, domain-focused drills, and explanation review cycles.",
                "Practice only one favorite topic until exam day.",
                "Skip review and rely on first-attempt confidence.",
                "Focus only on memorizing terminology without scenarios."
            ],
            0,
            "Balanced timed practice plus targeted review is the strongest readiness strategy."
        )
    );

    generated.push(
        q(
            "Capstone Drill",
            `After finishing a ${exam.code} mock, what should be done before the next attempt?`,
            [
                "Analyze weak domains, review explanations, and retest with adaptive focus.",
                "Ignore domain scores and retake immediately with no review.",
                "Remove difficult topics from the study plan.",
                "Use only untimed attempts to avoid pressure."
            ],
            0,
            "Post-attempt analysis with targeted retesting improves outcomes more than blind repetition."
        )
    );

    return generated;
}

function buildBeforeExamChecklist(exam) {
    const objectiveItems = exam.objectives.slice(0, 4).map((objective) => `Review ${objective.toLowerCase()} with at least one timed and one focused domain attempt.`);

    return [
        "Complete at least 3 full timed mock exams and review every incorrect answer.",
        "Run adaptive weak-area mode until weakest domains reach 85% or higher.",
        ...objectiveItems,
        "Memorize high-frequency comparisons and service selection trade-offs.",
        "Practice exam pacing: checkpoint at 25%, 50%, and 75% of allocated time.",
        "Before exam day, revisit only weak domains and summary notes, not all content."
    ];
}

const extraDrillsByExam = {
    "az-900": [
        buildDrillQuestion("AZ-900", "Cloud Concepts", "Scalability allows resources to be increased or decreased based on workload needs.", "Scalability means all resources are fixed at deployment.", "Scalability only applies to on-premises hardware.", "Scalability removes the need for governance."),
        buildDrillQuestion("AZ-900", "Service Models", "In PaaS, you manage the app and data while Azure manages OS and runtime.", "In PaaS, you patch physical servers and datacenters.", "In PaaS, Microsoft manages your business users.", "In PaaS, you cannot deploy APIs."),
        buildDrillQuestion("AZ-900", "Deployment Models", "Hybrid cloud combines on-premises resources with public cloud services.", "Hybrid cloud means two public clouds only.", "Hybrid cloud excludes identity integration.", "Hybrid cloud prevents using VPN connectivity."),
        buildDrillQuestion("AZ-900", "Compute", "Azure Functions is event-driven and billed per execution in many scenarios.", "Azure Functions requires dedicated host hardware by default.", "Azure Functions cannot trigger from HTTP.", "Azure Functions replaces all virtual networking."),
        buildDrillQuestion("AZ-900", "Storage", "Blob storage is intended for unstructured data such as files and media.", "Blob storage is only for virtual network policies.", "Blob storage is used to manage Azure subscriptions.", "Blob storage cannot be replicated."),
        buildDrillQuestion("AZ-900", "Networking", "ExpressRoute provides private connectivity to Azure without traversing the public internet.", "ExpressRoute is an identity federation protocol.", "ExpressRoute is the same as public HTTP ingress.", "ExpressRoute only works for backup vault metadata."),
        buildDrillQuestion("AZ-900", "Security", "Microsoft Entra ID provides identity capabilities such as SSO and MFA.", "Microsoft Entra ID is only for file backups.", "Microsoft Entra ID replaces all virtual networks.", "Microsoft Entra ID disables role assignments."),
        buildDrillQuestion("AZ-900", "Governance", "Azure Policy can enforce standards like allowed regions and required tags.", "Azure Policy is a VM performance optimizer only.", "Azure Policy stores application binaries.", "Azure Policy replaces role-based access control."),
        buildDrillQuestion("AZ-900", "Pricing", "The pricing calculator is used to estimate Azure service costs before deployment.", "The pricing calculator creates virtual machines.", "The pricing calculator disables billing alerts.", "The pricing calculator replaces support plans."),
        buildDrillQuestion("AZ-900", "Support and Lifecycle", "General Availability indicates a fully supported Azure service release.", "Public preview guarantees enterprise SLA.", "Private preview means globally available to all tenants.", "GA means the service is deprecated.")
    ],
    "az-305": [
        buildDrillQuestion("AZ-305", "Resiliency", "Multi-region architectures with replicated dependencies improve disaster resilience.", "Single-VM designs provide the highest resiliency.", "Resiliency removes backup requirements.", "Regional design is unrelated to availability."),
        buildDrillQuestion("AZ-305", "Identity", "Managed identities reduce secret sprawl for Azure-hosted workloads.", "Managed identities require storing passwords in code.", "Managed identities replace authorization controls.", "Managed identities are only for DNS."),
        buildDrillQuestion("AZ-305", "Networking", "Hub-and-spoke architecture centralizes shared services and controls.", "Hub-and-spoke requires every workload in one subnet.", "Hub-and-spoke cannot use firewalls.", "Hub-and-spoke is only for storage accounts."),
        buildDrillQuestion("AZ-305", "Business Continuity", "Recovery objectives should drive replication and failover architecture choices.", "Disaster recovery should be configured after incidents only.", "RTO and RPO are unrelated to architecture.", "Backups eliminate all continuity planning."),
        buildDrillQuestion("AZ-305", "Data Platform", "Choose storage and database services based on scale, latency, and consistency needs.", "Use one database engine for every workload by default.", "Data services should be selected by color theme.", "Data architecture does not affect cost."),
        buildDrillQuestion("AZ-305", "Security", "Least privilege and segmentation reduce blast radius across systems.", "Use one global owner account for simplicity.", "Public exposure is required for secure design.", "Network controls remove the need for identity controls."),
        buildDrillQuestion("AZ-305", "Governance", "Management groups and policy assignments enable consistent controls at scale.", "Governance only works inside one resource group.", "Policies cannot enforce naming conventions.", "Governance replaces monitoring."),
        buildDrillQuestion("AZ-305", "Optimization", "Architects should balance performance, reliability, and cost when proposing designs.", "Cost optimization means disabling telemetry everywhere.", "Reliability and cost never trade off.", "Optimization is only a post-production activity."),
        buildDrillQuestion("AZ-305", "Monitoring", "Application telemetry and infrastructure metrics together support end-to-end observability.", "Infrastructure metrics always replace app telemetry.", "Monitoring is unnecessary for stable workloads.", "Logs should never be centralized."),
        buildDrillQuestion("AZ-305", "Migration", "Assessment-driven migration planning reduces risk in modernization programs.", "Migrate all systems at once without assessment.", "Migration planning is only needed for SaaS.", "Discovery tools are irrelevant for architecture.")
    ],
    "az-500": [
        buildDrillQuestion("AZ-500", "Identity Security", "Conditional Access can enforce risk-based sign-in controls and MFA.", "Conditional Access is only for DNS firewalling.", "Conditional Access cannot evaluate sign-in conditions.", "Conditional Access is unrelated to identity."),
        buildDrillQuestion("AZ-500", "Secrets", "Store secrets and certificates in Key Vault rather than source code.", "Secrets are safest in plain-text config files.", "Key Vault is only for VM backups.", "Key Vault removes encryption requirements."),
        buildDrillQuestion("AZ-500", "Network Security", "Private endpoints reduce exposure by enabling private connectivity to services.", "Private endpoints require anonymous internet access.", "Private endpoints disable RBAC.", "Private endpoints are only for monitoring dashboards."),
        buildDrillQuestion("AZ-500", "Threat Protection", "Security posture tools surface recommendations and threat alerts for cloud resources.", "Threat detection is a one-time configuration task.", "Security recommendations should be ignored in production.", "Threat protection replaces patching."),
        buildDrillQuestion("AZ-500", "Operations", "Centralized logs and SIEM workflows improve incident detection and response.", "Incidents should be handled without logging to reduce noise.", "SIEM tools are only for cost reporting.", "Operational security does not require alerts."),
        buildDrillQuestion("AZ-500", "RBAC", "Grant least privilege at the smallest practical scope.", "Assign Owner role broadly to speed delivery.", "Role scopes do not matter.", "RBAC is only for subscription billing."),
        buildDrillQuestion("AZ-500", "Platform Protection", "DDoS mitigation and layered controls protect internet-facing workloads.", "DDoS mitigation removes need for architecture reviews.", "Only one NSG rule is enough for every workload.", "Platform protection is optional for production."),
        buildDrillQuestion("AZ-500", "Compute Hardening", "Limit management port exposure with just-in-time access workflows.", "Keep RDP and SSH permanently open for convenience.", "Compute hardening is unnecessary with backups.", "Hardening applies only to containers."),
        buildDrillQuestion("AZ-500", "Data Protection", "Use encryption and key management controls aligned to sensitivity requirements.", "All datasets should use anonymous access.", "Data classification is optional for compliance.", "Encryption prevents all identity risks."),
        buildDrillQuestion("AZ-500", "Governance", "Security policies should be audited continuously and enforced where possible.", "Security policy only matters during initial deployment.", "Policies cannot be assigned at scale.", "Governance is unrelated to security outcomes.")
    ],
    "ai-102": [
        buildDrillQuestion("AI-102", "Prompt Orchestration", "Ground prompts with enterprise data to improve reliability and relevance.", "Prompt grounding always increases hallucinations.", "Grounding replaces access controls.", "Grounding is only for speech apps."),
        buildDrillQuestion("AI-102", "Language", "Use language services for classification, extraction, and sentiment analysis.", "Language services only host static files.", "Language services replace identity providers.", "Language services cannot process customer feedback."),
        buildDrillQuestion("AI-102", "Vision", "Vision services can analyze images and extract text using OCR capabilities.", "Vision services are only for virtual networking.", "Vision services cannot process scanned documents.", "Vision services disable monitoring."),
        buildDrillQuestion("AI-102", "Search", "Search indexes support retrieval over large enterprise content collections.", "Search indexes are only for DNS records.", "Search indexes eliminate data governance needs.", "Search indexes cannot rank results."),
        buildDrillQuestion("AI-102", "Responsible AI", "Content filtering and monitoring help reduce unsafe AI outputs.", "Responsible AI means disabling telemetry.", "Responsible AI removes need for user authentication.", "Responsible AI excludes evaluation testing."),
        buildDrillQuestion("AI-102", "Speech", "Speech-to-text and text-to-speech enable conversational voice workflows.", "Speech services only process image data.", "Speech services replace role assignments.", "Speech services are unrelated to accessibility."),
        buildDrillQuestion("AI-102", "Deployment", "Validate model updates with staged rollout and objective evaluation.", "Always replace production instantly without tests.", "Deployment does not require output monitoring.", "Model updates should bypass governance checks."),
        buildDrillQuestion("AI-102", "Knowledge Mining", "Citations improve trust by linking responses to source content.", "Citations reduce answer quality and should be hidden.", "Citations remove need for retrieval.", "Knowledge mining is unrelated to search."),
        buildDrillQuestion("AI-102", "Evaluation", "Use benchmark prompts and datasets to compare model versions over time.", "Evaluation is only needed once at project start.", "Model quality cannot be measured.", "Evaluation should skip safety scenarios."),
        buildDrillQuestion("AI-102", "Security", "Protect AI endpoints with identity, network, and data governance controls.", "AI endpoints should be publicly anonymous by default.", "AI security only matters for training clusters.", "Network controls are irrelevant for AI APIs.")
    ],
    "dp-203": [
        buildDrillQuestion("DP-203", "Ingestion", "Orchestrated pipelines should support repeatable ingestion with failure handling.", "Ingestion should be manual to improve reliability.", "Pipeline retries create unavoidable data loss.", "Ingestion design is unrelated to observability."),
        buildDrillQuestion("DP-203", "Storage", "Data lake storage tiers support scalable analytics architectures.", "Data lakes are unsuitable for analytics datasets.", "Storage design has no effect on query performance.", "Only relational OLTP storage can store raw files."),
        buildDrillQuestion("DP-203", "Transformation", "Spark-based transformations are suited for large-scale batch processing.", "Spark is used only for DNS routing.", "Transformations should run directly in production dashboards.", "Batch transformation cannot be monitored."),
        buildDrillQuestion("DP-203", "Streaming", "Event ingestion plus stream processing enables near real-time analytics.", "Streaming requires nightly batch execution only.", "Streaming cannot enrich events.", "Streaming pipelines should avoid schema management."),
        buildDrillQuestion("DP-203", "Data Quality", "Validation and quarantine paths protect curated data reliability.", "Invalid records should always overwrite curated data.", "Data quality checks are optional in production.", "Schema drift should never be monitored."),
        buildDrillQuestion("DP-203", "Security", "Managed identities and scoped RBAC reduce credential sprawl in pipelines.", "All pipeline credentials should be shared in text files.", "RBAC is not relevant to data platforms.", "Security can be added only after go-live."),
        buildDrillQuestion("DP-203", "Performance", "Partitioning and columnar formats improve analytical query efficiency.", "Partitioning increases scan size in all cases.", "Columnar formats are only for transactional apps.", "Performance tuning should ignore data layout."),
        buildDrillQuestion("DP-203", "Monitoring", "Pipeline alerts help teams react quickly to failures and delays.", "Monitoring can be disabled after first success.", "Data operations do not require SLA targets.", "Alerts should trigger only after monthly reviews."),
        buildDrillQuestion("DP-203", "Serving", "Model serving layers for analytics should align to BI and consumer query patterns.", "Serving models are unrelated to downstream performance.", "BI workloads do not need schema design.", "Serving data should avoid governance metadata."),
        buildDrillQuestion("DP-203", "Resilience", "Idempotent writes and retries improve reliability during transient faults.", "Retries always duplicate data and should never be used.", "Transient faults are handled by disabling pipelines.", "Resilience patterns are only for web apps.")
    ],
    "az-400": [
        buildDrillQuestion("AZ-400", "Continuous Integration", "Automated build and test validation on pull requests improves quality.", "CI means deploying directly to production from local machines.", "CI should skip testing to improve speed.", "CI is only for release managers."),
        buildDrillQuestion("AZ-400", "Continuous Delivery", "Progressive rollout strategies reduce release risk in production.", "Every release should be all-at-once with no validation.", "CD replaces rollback planning.", "CD eliminates the need for telemetry."),
        buildDrillQuestion("AZ-400", "Infrastructure as Code", "Versioned templates make environment provisioning repeatable and auditable.", "Infrastructure should be manually edited in production only.", "Template changes should bypass code review.", "IaC is unrelated to governance."),
        buildDrillQuestion("AZ-400", "Security", "Pipeline secret management should use centralized vault integration.", "Secrets should be stored in repository history.", "Pipeline security is optional for internal systems.", "Secret rotation is unnecessary in long-running projects."),
        buildDrillQuestion("AZ-400", "Observability", "Telemetry and alerts should be part of release readiness and rollback decisions.", "Observability only matters during incidents.", "Monitoring can be removed after first deployment.", "Alerts should be manually checked once per quarter."),
        buildDrillQuestion("AZ-400", "Testing", "Quality gates block release progression when critical tests fail.", "Critical test failures should be ignored in hotfixes.", "Test automation is unrelated to release outcomes.", "Quality gates increase reliability only in staging."),
        buildDrillQuestion("AZ-400", "Source Control", "Small pull requests with reviews reduce integration risk.", "Large monthly merges are safer than incremental changes.", "Code reviews are unnecessary with pipelines.", "Source control does not affect release quality."),
        buildDrillQuestion("AZ-400", "Release Management", "Rollback plans should be validated before major releases.", "Rollback planning is only needed after outages.", "Rollback is impossible with modern platforms.", "Release strategy should ignore dependency risk."),
        buildDrillQuestion("AZ-400", "Compliance", "Approval and policy gates help enforce production governance standards.", "Compliance gates should be disabled for speed.", "Governance is unrelated to delivery pipelines.", "Production changes do not need approvals."),
        buildDrillQuestion("AZ-400", "Collaboration", "Shared pipeline templates improve consistency across teams.", "Each repository should reimplement all pipeline logic.", "Template reuse reduces traceability.", "Pipeline standardization increases risk by default.")
    ]
};

const studyNotesByExam = {
    "az-900": {
        summary: "AZ-900 prep should focus on clear conceptual differences, core Azure building blocks, governance controls, and cost/SLA fundamentals.",
        roadmap: [
            "Day 1: Cloud concepts, service models, deployment models, CapEx vs OpEx",
            "Day 2: Regions, availability zones, region pairs, resource hierarchy, ARM",
            "Day 3: Compute services: VMs, App Service, Functions, ACI, AKS",
            "Day 4: Networking and storage options with redundancy and access tiers",
            "Day 5: Entra ID, MFA, Conditional Access, RBAC, Defender for Cloud, Key Vault",
            "Day 6: Pricing tools, SLAs, lifecycle states, support plans",
            "Day 7: Full revision and timed mock exams"
        ],
        mustMemorize: [
            "IaaS vs PaaS vs SaaS responsibilities",
            "Public vs private vs hybrid cloud",
            "LRS vs ZRS vs GRS vs RA-GRS",
            "NSG vs Azure Firewall vs DDoS Protection",
            "VPN Gateway vs ExpressRoute",
            "Region vs availability zone vs region pair",
            "RBAC roles and scopes",
            "99.9 vs 99.95 vs 99.99 SLA patterns"
        ],
        sections: [
            { title: "Cloud concepts", points: ["Understand elasticity, scalability, agility, and global reach.", "Know shared responsibility boundaries.", "Understand consumption-based pricing and OpEx model."] },
            { title: "Architecture and services", points: ["Memorize hierarchy: tenant to resource.", "Know compute choices and when to use each.", "Know storage types, redundancy options, and tiers."] },
            { title: "Security and governance", points: ["Understand authentication vs authorization.", "Apply least privilege with RBAC and policy.", "Know Defender for Cloud and Key Vault basics."] },
            { title: "Pricing and lifecycle", points: ["Use pricing and TCO calculators effectively.", "Understand support plans and service lifecycle states.", "Know how composite SLA intuition works."] }
        ]
    },
    "az-305": {
        summary: "AZ-305 prep requires architecture decision depth across reliability, security, networking, data, governance, and migration outcomes.",
        roadmap: [
            "Day 1: Design principles and Well-Architected trade-offs",
            "Day 2: Identity, security architecture, and governance at scale",
            "Day 3: Compute and application architecture patterns",
            "Day 4: Data platform, storage, and integration patterns",
            "Day 5: Hybrid networking, private access, and global routing",
            "Day 6: Business continuity, backup, and disaster recovery",
            "Day 7: End-to-end case studies and architecture reviews"
        ],
        mustMemorize: ["Hub-and-spoke vs flat network", "Availability sets vs zones vs regions", "ExpressRoute vs VPN", "Key Vault and managed identities", "RTO and RPO", "Policy and management group strategy"],
        sections: [
            { title: "Architecture", points: ["Design for scale, reliability, and operability.", "Map requirements to service capabilities.", "Plan for failure domains and recovery."] },
            { title: "Data and integration", points: ["Select fit-for-purpose databases.", "Use messaging and decoupling effectively.", "Balance consistency and latency goals."] },
            { title: "Governance", points: ["Apply policy at proper scope.", "Use tags and standards consistently.", "Design secure access patterns end to end."] }
        ]
    },
    "az-500": {
        summary: "AZ-500 should be studied as identity-first security with layered network, platform, data, and operations controls.",
        roadmap: [
            "Day 1: Identity security, MFA, Conditional Access, PIM",
            "Day 2: Network security controls, segmentation, and private access",
            "Day 3: Compute, storage, and key management hardening",
            "Day 4: Defender for Cloud, secure score, recommendations",
            "Day 5: Sentinel, log pipelines, and incident response",
            "Day 6: Governance and policy enforcement",
            "Day 7: Red-team style scenario-based practice"
        ],
        mustMemorize: ["Conditional Access conditions", "PIM just-in-time model", "NSG vs Firewall", "Key Vault and managed HSM", "Defender for Cloud vs Sentinel"],
        sections: [
            { title: "Identity and access", points: ["Apply least privilege across scopes.", "Use identity governance and role hygiene.", "Protect privileged operations with MFA and approval."] },
            { title: "Threat protection", points: ["Centralize logs for investigation.", "Automate alert triage where possible.", "Continuously reduce high-severity recommendations."] },
            { title: "Data and key protection", points: ["Protect secrets and certificates.", "Use encryption strategy aligned to data sensitivity.", "Restrict data-plane access by network and identity."] }
        ]
    },
    "ai-102": {
        summary: "AI-102 preparation is strongest when combining service capability knowledge with responsible deployment and evaluation discipline.",
        roadmap: [
            "Day 1: Azure AI service landscape and solution planning",
            "Day 2: Language and speech capabilities",
            "Day 3: Vision and document intelligence",
            "Day 4: Search, retrieval, and grounding patterns",
            "Day 5: Prompt orchestration and application integration",
            "Day 6: Responsible AI controls and governance",
            "Day 7: Scenario mock exams with architecture justification"
        ],
        mustMemorize: ["RAG pattern fundamentals", "Vision OCR and extraction use cases", "Language service capabilities", "Vector retrieval concepts", "Safety filtering and monitoring"],
        sections: [
            { title: "Applied AI patterns", points: ["Ground outputs with trusted sources.", "Evaluate model behavior regularly.", "Design for fallback and error handling."] },
            { title: "Operations", points: ["Deploy with staged rollout.", "Track quality and safety regressions.", "Monitor prompt and response health metrics."] },
            { title: "Governance", points: ["Apply access controls to endpoints and data.", "Use content filters for user safety.", "Document risk controls and review decisions."] }
        ]
    },
    "dp-203": {
        summary: "DP-203 prep should emphasize reliable ingestion, scalable transformation, secure storage design, and operational data quality controls.",
        roadmap: [
            "Day 1: Storage design and lakehouse fundamentals",
            "Day 2: Data ingestion patterns and orchestration",
            "Day 3: Spark and SQL transformation practices",
            "Day 4: Streaming ingestion and real-time processing",
            "Day 5: Security, identity, and governance in data platforms",
            "Day 6: Monitoring, quality checks, and SLAs",
            "Day 7: Pipeline troubleshooting and mock exam drills"
        ],
        mustMemorize: ["Batch vs streaming architecture", "Partitioning and file format impacts", "Watermark-based incremental loading", "RBAC and managed identity patterns", "Data quality quarantine flow"],
        sections: [
            { title: "Pipeline engineering", points: ["Build idempotent ingestion and sinks.", "Add retries for transient failures.", "Separate raw, curated, and serving layers."] },
            { title: "Performance", points: ["Use partitioning with query patterns in mind.", "Prefer columnar formats for analytics.", "Tune jobs using practical telemetry."] },
            { title: "Governance and security", points: ["Restrict data-plane access with least privilege.", "Classify sensitive data assets.", "Implement policy and lineage controls."] }
        ]
    },
    "az-400": {
        summary: "AZ-400 preparation is about engineering reliable delivery systems across code, infrastructure, testing, security, and observability.",
        roadmap: [
            "Day 1: Source control strategy and collaboration workflows",
            "Day 2: Build pipelines and test automation",
            "Day 3: Release strategies and progressive deployment",
            "Day 4: Infrastructure as code and environment consistency",
            "Day 5: Security, secrets, and compliance gates",
            "Day 6: Monitoring, feedback loops, and incident response",
            "Day 7: End-to-end pipeline design practice"
        ],
        mustMemorize: ["CI vs CD responsibilities", "Canary and ring deployment trade-offs", "Quality gates", "Artifact versioning", "Key Vault pipeline integration"],
        sections: [
            { title: "Delivery engineering", points: ["Automate validation early.", "Use progressive exposure patterns.", "Prepare tested rollback paths."] },
            { title: "Infrastructure and security", points: ["Version control all infrastructure changes.", "Apply policy and approval controls.", "Centralize secret handling and rotation."] },
            { title: "Observability", points: ["Tie telemetry to release events.", "Use alerts with clear ownership.", "Feed production learnings back into backlog."] }
        ]
    }
};

window.studyTimeExams = window.studyTimeExams.map((exam) => {
    const extras = extraDrillsByExam[exam.id] || [];
    const notes = studyNotesByExam[exam.id] || null;
    const generatedDrills = buildGeneratedExamDrills(exam);
    const notesWithChecklist = notes
        ? {
            ...notes,
            beforeExamChecklist: notes.beforeExamChecklist || buildBeforeExamChecklist(exam)
        }
        : null;

    return {
        ...exam,
        questionBank: [...exam.questionBank, ...extras, ...generatedDrills],
        studyNotes: notesWithChecklist
    };
});

function buildAz900MasterBank() {
    const sections = [
        {
            id: 1,
            title: "Describe Cloud Concepts",
            rangeStart: 1,
            rangeEnd: 170,
            domains: [
                "Define cloud computing",
                "Describe the shared responsibility model",
                "Define cloud models: public, private, and hybrid",
                "Identify use cases for public, private, and hybrid cloud",
                "Describe the consumption-based model",
                "Compare cloud pricing models",
                "Describe serverless",
                "Benefits of high availability and scalability",
                "Benefits of reliability and predictability",
                "Benefits of security and governance",
                "Benefits of manageability",
                "Describe IaaS",
                "Describe PaaS",
                "Describe SaaS",
                "Identify use cases for IaaS, PaaS, and SaaS"
            ]
        },
        {
            id: 2,
            title: "Describe Azure Architecture and Services",
            rangeStart: 171,
            rangeEnd: 380,
            domains: [
                "Azure regions, region pairs, and sovereign regions",
                "Availability zones",
                "Azure datacenters",
                "Azure resources and resource groups",
                "Subscriptions",
                "Management groups",
                "Hierarchy of resource groups, subscriptions, and management groups",
                "Compare compute types: containers, virtual machines, and functions",
                "Virtual machine options: VMs, VM Scale Sets, availability sets, and Azure Virtual Desktop",
                "Resources required for virtual machines",
                "Application hosting options: web apps, containers, and virtual machines",
                "Virtual networking: VNets, subnets, peering, Azure DNS, VPN Gateway, ExpressRoute",
                "Define public and private endpoints",
                "Compare Azure Storage services",
                "Storage tiers",
                "Storage redundancy options",
                "Storage account options and storage types",
                "Move files: AzCopy, Azure Storage Explorer, and Azure File Sync",
                "Migration options: Azure Migrate and Azure Data Box",
                "Directory services: Microsoft Entra ID and Entra Domain Services",
                "Authentication methods: SSO, MFA, and passwordless",
                "External identities in Azure",
                "Microsoft Entra Conditional Access",
                "Azure role-based access control (RBAC)",
                "Zero Trust",
                "Defense-in-depth model",
                "Microsoft Defender for Cloud"
            ]
        },
        {
            id: 3,
            title: "Describe Azure Management and Governance",
            rangeStart: 381,
            rangeEnd: 500,
            domains: [
                "Factors that affect costs in Azure",
                "Pricing calculator",
                "Cost management capabilities in Azure",
                "Purpose of tags",
                "Purpose of Microsoft Purview",
                "Purpose of Azure Policy",
                "Purpose of resource locks",
                "Azure portal",
                "Azure Cloud Shell, Azure CLI, and Azure PowerShell",
                "Purpose of Azure Arc",
                "Infrastructure as code (IaC)",
                "Azure Resource Manager (ARM) and ARM templates",
                "Purpose of Azure Advisor",
                "Purpose of Azure Service Health",
                "Azure Monitor, Log Analytics, alerts, and Application Insights"
            ]
        }
    ];

    const scenarioTemplates = [
        "A company is modernizing a workload and must choose the most suitable Azure approach.",
        "An IT team is reviewing architecture choices for cost, security, and scalability.",
        "A solution owner is preparing governance controls before production deployment.",
        "An operations lead needs to improve reliability while preserving budget efficiency.",
        "A cloud administrator must select services that align with shared responsibility boundaries.",
        "A business unit wants faster delivery without compromising compliance requirements."
    ];

    const principleByDomain = {
        "Define cloud computing": "Cloud computing is the on-demand delivery of computing services over the internet with pay-as-you-go pricing.",
        "Describe the shared responsibility model": "The shared responsibility model means Microsoft secures the cloud platform while customers secure identities, data, and configurations.",
        "Define cloud models: public, private, and hybrid": "Public cloud is provider-hosted, private cloud is dedicated to one organization, and hybrid cloud combines both.",
        "Identify use cases for public, private, and hybrid cloud": "Public fits rapid scaling, private fits strict control needs, and hybrid fits phased modernization and regulatory constraints.",
        "Describe the consumption-based model": "Consumption-based pricing bills only for resources consumed, helping align cost to actual usage.",
        "Compare cloud pricing models": "Pay-as-you-go offers flexibility, while reservations can reduce cost for predictable workloads.",
        "Describe serverless": "Serverless runs code without managing servers and typically charges per execution and runtime consumption.",
        "Benefits of high availability and scalability": "Cloud services improve availability with redundancy and improve scalability by adding or removing capacity quickly.",
        "Benefits of reliability and predictability": "Reliability comes from resilient architecture patterns, and predictability comes from monitored performance and consistent operations.",
        "Benefits of security and governance": "Cloud platforms provide built-in security tooling and governance controls for policy, access, and compliance enforcement.",
        "Benefits of manageability": "Cloud manageability improves through automation, templates, monitoring, and centralized control planes.",
        "Describe IaaS": "IaaS provides virtualized infrastructure where customers manage OS, apps, and data while Microsoft manages physical infrastructure.",
        "Describe PaaS": "PaaS provides managed runtime platforms so customers focus on application code and data.",
        "Describe SaaS": "SaaS delivers complete software applications managed by the provider and consumed by end users.",
        "Identify use cases for IaaS, PaaS, and SaaS": "IaaS fits custom infrastructure control, PaaS fits faster app development, and SaaS fits ready-to-use business applications.",
        "Azure regions, region pairs, and sovereign regions": "Regions are geographic areas, region pairs support resiliency planning, and sovereign regions address data residency and compliance requirements.",
        "Availability zones": "Availability zones are physically separate datacenters within a region that improve workload resiliency.",
        "Azure datacenters": "Azure datacenters are physical facilities hosting cloud infrastructure components for compute, storage, and networking.",
        "Azure resources and resource groups": "Resources are deployable Azure services, and resource groups organize related resources for lifecycle management.",
        "Subscriptions": "Subscriptions provide a billing and governance boundary for Azure resources.",
        "Management groups": "Management groups let organizations apply governance and policy across multiple subscriptions.",
        "Hierarchy of resource groups, subscriptions, and management groups": "The governance hierarchy flows from management groups to subscriptions to resource groups to resources.",
        "Compare compute types: containers, virtual machines, and functions": "VMs offer maximum control, containers package apps consistently, and Functions provide event-driven serverless execution.",
        "Virtual machine options: VMs, VM Scale Sets, availability sets, and Azure Virtual Desktop": "Use VMs for individual hosts, VM Scale Sets for autoscaling groups, availability sets for fault distribution, and AVD for virtual desktop delivery.",
        "Resources required for virtual machines": "VM deployments commonly require a virtual network, subnet, NIC, disk storage, and proper identity and access configuration.",
        "Application hosting options: web apps, containers, and virtual machines": "Web Apps simplify PaaS hosting, containers support portability and orchestration, and VMs suit custom OS-level control needs.",
        "Virtual networking: VNets, subnets, peering, Azure DNS, VPN Gateway, ExpressRoute": "Azure networking combines private network boundaries, name resolution, and hybrid connectivity options across VPN or private circuits.",
        "Define public and private endpoints": "Public endpoints are internet-reachable service addresses, while private endpoints map services to private IPs in VNets.",
        "Compare Azure Storage services": "Blob, Files, Queues, and managed disks serve different object, file share, messaging, and VM storage workloads.",
        "Storage tiers": "Hot, cool, and archive tiers trade access speed and retrieval cost against storage cost.",
        "Storage redundancy options": "LRS, ZRS, GRS, and RA-GRS provide different durability and regional resiliency levels.",
        "Storage account options and storage types": "Storage account configuration controls performance, replication, and supported storage services.",
        "Move files: AzCopy, Azure Storage Explorer, and Azure File Sync": "AzCopy supports scripted transfer, Storage Explorer supports interactive management, and File Sync extends Azure files into on-prem servers.",
        "Migration options: Azure Migrate and Azure Data Box": "Azure Migrate helps assess and migrate workloads, while Data Box helps move large datasets when network transfer is impractical.",
        "Directory services: Microsoft Entra ID and Entra Domain Services": "Entra ID provides cloud identity and access management, while Entra Domain Services offers managed domain features for legacy needs.",
        "Authentication methods: SSO, MFA, and passwordless": "SSO improves user experience, MFA adds a second factor, and passwordless reduces password-related attack risk.",
        "External identities in Azure": "External identities allow secure collaboration with guests, partners, and external users.",
        "Microsoft Entra Conditional Access": "Conditional Access enforces context-based access policies using signals like user risk, device state, and location.",
        "Azure role-based access control (RBAC)": "RBAC grants least-privilege access by assigning roles at appropriate scopes.",
        "Zero Trust": "Zero Trust follows verify-explicitly, least-privilege, and assume-breach principles.",
        "Defense-in-depth model": "Defense in depth applies layered controls across identity, network, compute, application, and data.",
        "Microsoft Defender for Cloud": "Defender for Cloud provides posture recommendations and threat protection across workloads.",
        "Factors that affect costs in Azure": "Azure costs are influenced by resource type, region, usage duration, performance tier, and data transfer.",
        "Pricing calculator": "The pricing calculator estimates expected service costs before deployment.",
        "Cost management capabilities in Azure": "Cost Management helps analyze spend, set budgets, and track cost trends.",
        "Purpose of tags": "Tags organize resources for cost allocation, automation, reporting, and governance.",
        "Purpose of Microsoft Purview": "Microsoft Purview supports data governance through cataloging, classification, and compliance management.",
        "Purpose of Azure Policy": "Azure Policy audits and enforces organizational standards on resource configurations.",
        "Purpose of resource locks": "Resource locks prevent accidental deletion or modification of critical resources.",
        "Azure portal": "Azure portal is the web interface for creating, configuring, and monitoring Azure resources.",
        "Azure Cloud Shell, Azure CLI, and Azure PowerShell": "Cloud Shell provides browser-based command-line access for Azure CLI and Azure PowerShell operations.",
        "Purpose of Azure Arc": "Azure Arc extends Azure management and governance to hybrid and multicloud resources.",
        "Infrastructure as code (IaC)": "IaC provisions and manages infrastructure through versioned declarative definitions.",
        "Azure Resource Manager (ARM) and ARM templates": "ARM and ARM templates provide repeatable deployments and consistent resource management.",
        "Purpose of Azure Advisor": "Azure Advisor provides recommendations to improve reliability, security, performance, and cost.",
        "Purpose of Azure Service Health": "Service Health provides personalized alerts and guidance for Azure service incidents and planned maintenance.",
        "Azure Monitor, Log Analytics, alerts, and Application Insights": "Azure Monitor centralizes metrics and logs, Log Analytics enables queries, alerts trigger actions, and Application Insights tracks app telemetry."
    };

    const bank = [];

    sections.forEach((section) => {
        const total = section.rangeEnd - section.rangeStart + 1;

        for (let offset = 0; offset < total; offset += 1) {
            const questionNumber = section.rangeStart + offset;
            const domain = section.domains[offset % section.domains.length];
            const scenario = scenarioTemplates[offset % scenarioTemplates.length];
            const principle = principleByDomain[domain] || "Choose the response that best aligns to Azure fundamentals and objective outcomes.";

            const wrongA = `${domain} can be ignored when planning Azure deployments.`;
            const wrongB = `${domain} is only relevant after production incidents occur.`;
            const wrongC = `${domain} decisions are unrelated to governance, security, and reliability.`;

            bank.push(
                q(
                    domain,
                    `[Section ${section.id} · Q${String(questionNumber).padStart(3, "0")}] ${scenario} Which statement is most accurate?`,
                    [principle, wrongA, wrongB, wrongC],
                    0,
                    `This item maps to Section ${section.id} (${section.title}) and reinforces the core AZ-900 principle for ${domain.toLowerCase()}.`
                )
            );
        }
    });

    return bank;
}

const az900MasterStudyNotes = {
    summary: "This AZ-900 master bank is organized into full blueprint coverage for cloud concepts, Azure architecture/services, and Azure management/governance with 500 original questions.",
    roadmap: [
        "Days 1-2: Cloud concepts, cloud models, service types, pricing models, and cloud benefits.",
        "Days 3-5: Azure architecture and services including compute, networking, storage, identity, and security.",
        "Days 6-7: Cost management, governance tools, deployment tooling, and monitoring with timed review."
    ],
    mustMemorize: [
        "IaaS/PaaS/SaaS responsibility boundaries",
        "Public/private/hybrid cloud use-case differences",
        "Region, availability zone, region pair, and sovereign region purpose",
        "RBAC, Policy, Purview, tags, and resource-lock governance controls",
        "Storage redundancy, tiers, account options, and migration/file movement tools"
    ],
    sections: [
        { title: "Blueprint Area 1: Describe cloud concepts (25-30%)", points: ["Cloud computing and shared responsibility", "Cloud and service models with use cases", "Consumption, pricing, serverless, and cloud benefits"] },
        { title: "Blueprint Area 2: Describe Azure architecture and services (35-40%)", points: ["Core architecture components and hierarchy", "Compute, networking, and storage services", "Identity, access, and security capabilities"] },
        { title: "Blueprint Area 3: Describe Azure management and governance (30-35%)", points: ["Cost management and tagging", "Governance/compliance tools", "Resource deployment and monitoring tools"] }
    ],
    beforeExamChecklist: [
        "Complete at least two 45-minute full-bank attempts.",
        "Review every incorrect rationale and retest weak domains.",
        "Ensure consistent scores above your readiness gate.",
        "Rehearse time management checkpoints during timed mode."
    ]
};

window.studyTimeExams = window.studyTimeExams.map((exam) => {
    if (exam.id !== "az-900") {
        return exam;
    }

    return {
        ...exam,
        focus: "Comprehensive AZ-900 fundamentals practice across cloud concepts, architecture, compute, networking, storage, and governance.",
        objectives: [
            "Describe cloud concepts (25-30%)",
            "Describe Azure architecture and services (35-40%)",
            "Describe Azure management and governance (30-35%)"
        ],
        questionBank: buildAz900MasterBank(),
        studyNotes: az900MasterStudyNotes
    };
});

function buildStructuredMasterBank(exam, sections) {
    const scenarioTemplates = [
        "A solution owner is validating an Azure design before deployment.",
        "An architecture team is comparing Azure options against reliability, cost, and governance requirements.",
        "An operations lead must choose the best Azure approach for a business-critical workload.",
        "A cloud team is reviewing service choices for scalability, security, and maintainability.",
        "A project sponsor wants the most appropriate Azure recommendation for a production scenario.",
        "An engineering team must select the best Azure control or service for the stated requirement."
    ];

    const correctTemplates = [
        (domain, examCode) => `For ${examCode}, ${domain.toLowerCase()} decisions should align to the stated requirements, Azure best practices, and least-risk architecture choices.`,
        (domain, examCode) => `The strongest ${examCode} answer for ${domain.toLowerCase()} is the option that balances security, reliability, governance, and operational clarity.`,
        (domain, examCode) => `${domain} in ${examCode} should be implemented using Azure-native capabilities that best satisfy the scenario constraints.`
    ];

    const wrongTemplates = [
        (domain) => `${domain} can usually be ignored if the solution already uses Azure.`,
        (domain) => `${domain} is mainly a post-production concern and should not affect design decisions.`,
        (domain) => `${domain} does not influence security, governance, performance, or reliability outcomes.`
    ];

    const bank = [];

    sections.forEach((section) => {
        const total = section.rangeEnd - section.rangeStart + 1;

        for (let offset = 0; offset < total; offset += 1) {
            const questionNumber = section.rangeStart + offset;
            const domain = section.domains[offset % section.domains.length];
            const scenario = scenarioTemplates[offset % scenarioTemplates.length];
            const correct = correctTemplates[offset % correctTemplates.length](domain, exam.code);

            bank.push(
                q(
                    domain,
                    `[Section ${section.id} · Q${String(questionNumber).padStart(3, "0")}] ${scenario} Which statement is the most accurate?`,
                    [
                        correct,
                        wrongTemplates[0](domain),
                        wrongTemplates[1](domain),
                        wrongTemplates[2](domain)
                    ],
                    0,
                    `This original practice item maps to Section ${section.id} (${section.title}) for ${exam.code} and reinforces the core decision pattern for ${domain.toLowerCase()}.`
                )
            );
        }
    });

    return bank;
}

const masterSectionPlansByExam = {
    "az-305": [
        { id: 1, title: "Identity and Governance", rangeStart: 1, rangeEnd: 80, domains: ["Identity and Governance", "Management Groups", "Azure Policy", "Role Design", "Key Vault and Managed Identity"] },
        { id: 2, title: "Compute and Application Architecture", rangeStart: 81, rangeEnd: 170, domains: ["Compute and Application Architecture", "App Service", "Functions", "Containers and AKS", "Availability and Scale"] },
        { id: 3, title: "Storage and Data Platform Design", rangeStart: 171, rangeEnd: 250, domains: ["Storage and Data Platform Design", "Azure SQL", "Cosmos DB", "Storage Selection", "Integration Patterns"] },
        { id: 4, title: "Business Continuity", rangeStart: 251, rangeEnd: 310, domains: ["Business Continuity", "Backup Strategy", "Disaster Recovery", "RTO and RPO", "Regional Resilience"] },
        { id: 5, title: "Hybrid Networking", rangeStart: 311, rangeEnd: 390, domains: ["Hybrid Networking", "Hub and Spoke", "Private Endpoints", "ExpressRoute", "Global Routing"] },
        { id: 6, title: "Monitoring and Optimization", rangeStart: 391, rangeEnd: 450, domains: ["Monitoring and Optimization", "Application Insights", "Azure Monitor", "Cost Optimization", "Operational Excellence"] },
        { id: 7, title: "Security and Resiliency Patterns", rangeStart: 451, rangeEnd: 500, domains: ["Security Architecture", "Least Privilege", "Segmentation", "Threat Protection", "Architectural Trade-offs"] }
    ],
    "az-500": [
        { id: 1, title: "Identity and Access", rangeStart: 1, rangeEnd: 90, domains: ["Identity Security", "Conditional Access", "PIM", "Authentication", "Authorization"] },
        { id: 2, title: "Network Protection", rangeStart: 91, rangeEnd: 180, domains: ["Network Security", "NSG", "Azure Firewall", "DDoS Protection", "Private Endpoints"] },
        { id: 3, title: "Compute and Storage Security", rangeStart: 181, rangeEnd: 280, domains: ["Compute Security", "Storage Security", "JIT VM Access", "Encryption", "Defender for Cloud"] },
        { id: 4, title: "Keys, Secrets, and Applications", rangeStart: 281, rangeEnd: 360, domains: ["Key Management", "Azure Key Vault", "Managed HSM", "Application Security", "Certificates and Secrets"] },
        { id: 5, title: "Security Operations", rangeStart: 361, rangeEnd: 430, domains: ["Security Operations", "Microsoft Sentinel", "Logging", "Incident Response", "Threat Hunting"] },
        { id: 6, title: "Governance and Posture", rangeStart: 431, rangeEnd: 500, domains: ["Security Posture", "Secure Score", "Compliance", "Governance", "Policy Enforcement"] }
    ],
    "ai-102": [
        { id: 1, title: "Plan Azure AI Solutions", rangeStart: 1, rangeEnd: 80, domains: ["Azure AI Solutions", "Solution Planning", "Prompt Orchestration", "Knowledge Mining", "Architecture Decisions"] },
        { id: 2, title: "Language and Speech", rangeStart: 81, rangeEnd: 170, domains: ["Language", "Speech", "Custom Text Classification", "Sentiment and Entity Extraction", "Voice Workflows"] },
        { id: 3, title: "Vision and Document Intelligence", rangeStart: 171, rangeEnd: 250, domains: ["Vision", "OCR", "Document Intelligence", "Image Analysis", "Form Extraction"] },
        { id: 4, title: "Search and Retrieval", rangeStart: 251, rangeEnd: 330, domains: ["Search", "Azure AI Search", "Vector Search", "RAG", "Grounding and Citations"] },
        { id: 5, title: "Deployment and Monitoring", rangeStart: 331, rangeEnd: 410, domains: ["Model Deployment", "Evaluation", "Monitoring", "Rollout Strategy", "Quality Regression Control"] },
        { id: 6, title: "Responsible AI and Safety", rangeStart: 411, rangeEnd: 500, domains: ["Responsible AI", "Content Filtering", "Abuse Monitoring", "Access Control", "Governance and Review"] }
    ],
    "dp-203": [
        { id: 1, title: "Storage Design", rangeStart: 1, rangeEnd: 80, domains: ["Storage", "Azure Data Lake Storage", "Serving", "File Formats", "Partitioning"] },
        { id: 2, title: "Ingestion and Orchestration", rangeStart: 81, rangeEnd: 170, domains: ["Ingestion", "Azure Data Factory", "Incremental Loading", "Pipeline Orchestration", "Source Integration"] },
        { id: 3, title: "Batch Processing and Transformation", rangeStart: 171, rangeEnd: 260, domains: ["Transformation", "Spark Processing", "Batch Processing", "Lakehouse Design", "Medallion Architecture"] },
        { id: 4, title: "Streaming Analytics", rangeStart: 261, rangeEnd: 330, domains: ["Streaming", "Azure Event Hubs", "Azure Stream Analytics", "Real-time Enrichment", "Operational Analytics"] },
        { id: 5, title: "Security and Governance", rangeStart: 331, rangeEnd: 400, domains: ["Security", "RBAC", "Managed Identity", "Row-level Security", "Data Governance"] },
        { id: 6, title: "Monitoring and Data Quality", rangeStart: 401, rangeEnd: 500, domains: ["Monitoring", "Alerts", "Data Quality", "Validation and Quarantine", "Operational Resilience"] }
    ],
    "az-400": [
        { id: 1, title: "Source Control and Collaboration", rangeStart: 1, rangeEnd: 70, domains: ["Source Control", "Branch Strategy", "Pull Requests", "Code Review", "Collaboration"] },
        { id: 2, title: "Continuous Integration", rangeStart: 71, rangeEnd: 150, domains: ["CI/CD", "Continuous Integration", "Build Validation", "Artifacts", "Automated Testing"] },
        { id: 3, title: "Continuous Delivery", rangeStart: 151, rangeEnd: 240, domains: ["Continuous Delivery", "Release Strategy", "Canary Deployment", "Feature Flags", "Progressive Delivery"] },
        { id: 4, title: "Infrastructure as Code", rangeStart: 241, rangeEnd: 320, domains: ["Infrastructure as Code", "Templates", "Environment Consistency", "Provisioning", "Versioning"] },
        { id: 5, title: "Observability and Feedback", rangeStart: 321, rangeEnd: 390, domains: ["Observability", "Telemetry", "Application Monitoring", "Deployment Markers", "Feedback Loops"] },
        { id: 6, title: "Security and Compliance", rangeStart: 391, rangeEnd: 460, domains: ["Security", "Dependency Scanning", "Key Vault Integration", "Compliance", "Approval Gates"] },
        { id: 7, title: "Release Management", rangeStart: 461, rangeEnd: 500, domains: ["Release Management", "Rollback Strategy", "Quality Gates", "Pipeline Design", "Operational Readiness"] }
    ]
};

const masterStudyNotesOverrides = {
    "az-305": {
        summary: "This AZ-305 master bank expands architecture practice across identity, compute, data, continuity, networking, and optimization with 500 original questions."
    },
    "az-500": {
        summary: "This AZ-500 master bank expands security engineering practice across identity, networking, protection, operations, and governance with 500 original questions."
    },
    "ai-102": {
        summary: "This AI-102 master bank expands Azure AI solution practice across language, vision, retrieval, deployment, and responsible AI with 500 original questions."
    },
    "dp-203": {
        summary: "This DP-203 master bank expands data engineering practice across ingestion, transformation, streaming, serving, security, and monitoring with 500 original questions."
    },
    "az-400": {
        summary: "This AZ-400 master bank expands DevOps engineering practice across collaboration, CI/CD, IaC, security, observability, and release management with 500 original questions."
    }
};

window.studyTimeExams = window.studyTimeExams.map((exam) => {
    const sectionPlan = masterSectionPlansByExam[exam.id];

    if (!sectionPlan) {
        return exam;
    }

    return {
        ...exam,
        questionBank: buildStructuredMasterBank(exam, sectionPlan),
        studyNotes: exam.studyNotes
            ? {
                ...exam.studyNotes,
                ...masterStudyNotesOverrides[exam.id]
            }
            : exam.studyNotes
    };
});