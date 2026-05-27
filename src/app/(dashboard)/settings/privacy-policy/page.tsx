"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicyPage() {
    const router = useRouter();

    return (
        <div className="pt-8 pb-16">
            {/* Header */}
            <div className="flex items-center gap-4 px-8 mb-8">
                <Button variant="ghost" size="icon" onClick={() => router.push("/settings")}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h2 className="text-2xl font-bold tracking-tight">Privacy Policy</h2>
            </div>

            {/* Content */}
            <div className="px-8 max-w-3xl">
                <p className="text-xs text-gray-400 mb-8">Last Updated: February 15, 2026</p>

                <section className="space-y-6">
                    <div>
                        <h3 className="text-lg font-bold mb-2">1. Introduction</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            ABM Workshop & Marketplace (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy.
                            This Privacy Policy explains how we collect, use, disclose, and safeguard your information
                            when you use our mobile application.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-lg font-bold mb-2">2. Information We Collect</h3>
                        <h4 className="text-sm font-semibold mt-3 mb-1">Personal Information</h4>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            When you create an account, we may collect:<br />
                            • Full name<br />
                            • Email address<br />
                            • Phone number<br />
                            • Profile information
                        </p>
                        <h4 className="text-sm font-semibold mt-3 mb-1">Vehicle Information</h4>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            If you use workshop services, we may collect:<br />
                            • Vehicle make, model, and year<br />
                            • License plate number<br />
                            • VIN (Vehicle Identification Number)<br />
                            • Service and maintenance history
                        </p>
                        <h4 className="text-sm font-semibold mt-3 mb-1">Location Data</h4>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            We collect location data only when you use tow request services to calculate distances and
                            provide accurate pricing. Location data is collected only while the app is in use and is not
                            stored permanently.
                        </p>
                        <h4 className="text-sm font-semibold mt-3 mb-1">Photos and Camera</h4>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            We access your camera and photo library only when you choose to upload images for service
                            requests, product listings, or profile photos. Images are stored securely in our cloud storage.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-lg font-bold mb-2">3. How We Use Your Information</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            We use the information we collect to:<br />
                            • Provide, operate, and maintain our services<br />
                            • Process transactions and send related information<br />
                            • Send push notifications about orders, jobs, and service updates<br />
                            • Facilitate tow truck services and distance-based pricing<br />
                            • Improve our app and develop new features<br />
                            • Communicate with you about your account and services<br />
                            • Detect and prevent fraud or abuse
                        </p>
                    </div>

                    <div>
                        <h3 className="text-lg font-bold mb-2">4. Data Sharing</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            We may share your information with:<br />
                            • Workshop service providers you interact with<br />
                            • Payment processors (Monnify) to process transactions<br />
                            • Cloud service providers (Firebase, Cloudinary) for data storage<br />
                            • Law enforcement when required by law<br /><br />
                            We do not sell your personal information to third parties.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-lg font-bold mb-2">5. Data Security</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            We implement industry-standard security measures to protect your data, including encrypted
                            data transmission, secure authentication via Firebase, and access controls. However, no
                            method of electronic storage is 100% secure.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-lg font-bold mb-2">6. Data Retention</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            We retain your personal data for as long as your account is active or as needed to provide
                            services. You can request deletion of your account and associated data at any time through
                            the Settings section of the app.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-lg font-bold mb-2">7. Your Rights</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            You have the right to:<br />
                            • Access your personal data<br />
                            • Correct inaccurate data<br />
                            • Delete your account and data<br />
                            • Opt out of push notifications<br />
                            • Opt out of email notifications<br />
                            • Withdraw consent for data processing
                        </p>
                    </div>

                    <div>
                        <h3 className="text-lg font-bold mb-2">8. Children&apos;s Privacy</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            Our service is not intended for users under the age of 13. We do not knowingly collect
                            personal information from children under 13.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-lg font-bold mb-2">9. Changes to This Policy</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            We may update this Privacy Policy from time to time. We will notify you of any changes
                            by posting the new policy in the app and updating the &quot;Last Updated&quot; date.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-lg font-bold mb-2">10. Contact Us</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            If you have questions about this Privacy Policy or our data practices, please contact us at:
                        </p>
                        <a href="mailto:support@abmtek.com" className="text-sm text-blue-600 underline">
                            support@abmtek.com
                        </a>
                    </div>
                </section>
            </div>
        </div>
    );
}
