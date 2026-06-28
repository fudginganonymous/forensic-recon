/**
 * ConsentPage
 *
 * Shown once to every participant after registration/login, before
 * they can access any case. Records consent via POST /auth/consent.
 * Once consented, this page is never shown again (has_consented flag
 * on the user object controls this).
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import type { User } from "../api/types";
import { Button, Card, ErrorMessage, extractErrorMessage } from "../components/ui";

export default function ConsentPage() {
    const { user, login } = useAuth();
    const navigate = useNavigate();
    const [agreed, setAgreed] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleConsent() {
        setSubmitting(true);
        setError(null);
        try {
            const res = await api.post<User>("/auth/consent");
            // Update stored user so has_consented is reflected immediately
            localStorage.setItem("current_user", JSON.stringify(res.data));
            navigate("/participant");
        } catch (err) {
            setError(extractErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    }

    function handleDecline() {
        // Log out and redirect — they cannot participate without consent
        localStorage.removeItem("access_token");
        localStorage.removeItem("current_user");
        navigate("/login");
    }

    return (
        <div className="min-h-screen bg-slate-50 py-10 px-4">
            <div className="max-w-3xl mx-auto space-y-6">

                {/* Header */}
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-slate-900">Participant Information Sheet</h1>
                    <p className="text-sm text-slate-500 mt-1">Please read this carefully before taking part.</p>
                </div>

                <Card>
                    {/* Ethics approval */}
                    <div className="bg-blue-50 border border-blue-100 rounded-md p-4 mb-6 text-sm text-blue-800">
                        <p><strong>UCL Research Ethics Committee Approval ID:</strong> 1330</p>
                    </div>

                    {/* Researcher details */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-sm">
                        <div className="bg-slate-50 rounded-md p-3">
                            <p className="font-semibold text-slate-700 mb-1">Principal Researcher</p>
                            <p className="text-slate-600">Shreya Shah</p>
                            <p className="text-slate-500">MSc Crime and Forensic Science</p>
                            <p className="text-slate-500">Department of Security and Crime Science</p>
                            <p className="text-slate-500">University College London</p>
                            <a href="mailto:shreya.shah.25@ucl.ac.uk" className="text-blue-600 hover:underline break-all">shreya.shah.25@ucl.ac.uk</a>
                        </div>
                        <div className="bg-slate-50 rounded-md p-3">
                            <p className="font-semibold text-slate-700 mb-1">Supervising Researcher</p>
                            <p className="text-slate-600">Dr. Ruth Morgan</p>
                            <p className="text-slate-500">Professor of Crime and Forensic Sciences</p>
                            <p className="text-slate-500">Department of Security and Crime Science</p>
                            <p className="text-slate-500">University College London</p>
                            <a href="mailto:ruth.morgan@ucl.ac.uk" className="text-blue-600 hover:underline break-all">ruth.morgan@ucl.ac.uk</a>
                        </div>
                        <div className="bg-slate-50 rounded-md p-3">
                            <p className="font-semibold text-slate-700 mb-1">Supervising Researcher</p>
                            <p className="text-slate-600">Dr. Noemie Bouhana</p>
                            <p className="text-slate-500">Professor of Crime Science and Counter Extremism</p>
                            <p className="text-slate-500">Department of Security and Crime Science</p>
                            <p className="text-slate-500">University College London</p>
                            <a href="mailto:noemie.bouhana@ucl.ac.uk" className="text-blue-600 hover:underline break-all">noemie.bouhana@ucl.ac.uk</a>
                        </div>
                    </div>

                    {/* Information sections */}
                    <div className="space-y-5 text-sm text-slate-700 leading-relaxed">

                        <section>
                            <h2 className="font-semibold text-slate-900 text-base mb-1">Welcome</h2>
                            <p>
                                You are invited to take part in a research study being conducted as part of an
                                MSc Crime and Forensic Science dissertation at University College London (UCL).
                                The study explores how forensic science practitioners and students approach
                                crime scene reconstruction, and specifically whether a structured digital
                                workflow influences hypothesis generation and decision-making during the
                                reconstruction process.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold text-slate-900 text-base mb-1">What is the purpose of the project?</h2>
                            <p>
                                The purpose of this research is to investigate whether a structured digital
                                crime scene reconstruction workflow improves hypothesis flexibility and reduces
                                premature closure compared to traditional free-form reconstruction methods.
                                Participants will complete a mock crime scene reconstruction exercise using
                                this web-based decision-support system. The findings will contribute to an
                                MSc dissertation and may improve understanding of cognitive processes in
                                forensic science practice.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold text-slate-900 text-base mb-1">Do I have to take part?</h2>
                            <p>
                                Taking part is entirely voluntary. You may stop completing the exercise at any
                                time before submitting your final reconstruction. After submitting, you may
                                withdraw your data within 72 hours by contacting the researcher and providing
                                your participant username. After this time, your responses may have been
                                anonymised and included in the analysis and can no longer be withdrawn.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold text-slate-900 text-base mb-1">Who can take part?</h2>
                            <p>
                                You are eligible to participate if you are aged 18 years or over and are
                                currently enrolled in or have completed a forensic science, crime science,
                                or related programme of study.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold text-slate-900 text-base mb-1">What will happen if I take part?</h2>
                            <p>
                                If you choose to participate, you will complete a structured mock crime scene
                                reconstruction exercise through this system. The exercise involves five stages:
                                recording observations, reviewing evidence, generating hypotheses, evaluating
                                evidence against each hypothesis, reviewing alternative hypotheses, and
                                submitting a final reconstruction. The exercise should take approximately
                                45–60 minutes to complete.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold text-slate-900 text-base mb-1">Are there any possible disadvantages or risks?</h2>
                            <p>
                                The scenarios used in this study involve the analysis of mock crime scenes
                                that may include graphic content. While the content is not real, some participants
                                may find this subject matter sensitive. If you feel uncomfortable at any point,
                                you are free to stop before submitting your final reconstruction.
                                There are no other foreseeable risks associated with participation.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold text-slate-900 text-base mb-1">Are there any benefits or rewards?</h2>
                            <p>
                                There are no direct personal benefits or rewards for taking part. However,
                                your participation will contribute to research that may improve forensic
                                science practice and the development of decision-support tools for crime
                                scene reconstruction.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold text-slate-900 text-base mb-1">What if something goes wrong?</h2>
                            <p>
                                If you have any questions or concerns about the research, you can contact the
                                researcher or dissertation supervisors using the contact details provided
                                above. If you wish to make a complaint about the study, you may contact the
                                Chair of the UCL Research Ethics Committee at{" "}
                                <a href="mailto:ethics@ucl.ac.uk" className="text-blue-600 hover:underline">ethics@ucl.ac.uk</a>.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold text-slate-900 text-base mb-1">Will my data be kept confidential?</h2>
                            <p>
                                Yes. Your participation is pseudonymous. You will not be asked to provide
                                your real name or any information that could directly identify you beyond
                                a participant username you create yourself. All responses will be treated
                                confidentially and accessed only by the researcher and dissertation
                                supervisors. You will not be identifiable from your responses in any
                                published findings.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold text-slate-900 text-base mb-1">What will happen to my data?</h2>
                            <p>
                                Your responses will be used solely for the purposes of this MSc Crime and
                                Forensic Science dissertation at University College London (UCL). All data
                                will be stored securely in accordance with UCL's data protection policies
                                and will only be accessible to the researcher and dissertation supervisors.
                                Any data used in the dissertation will be anonymised to ensure you cannot
                                be identified. Following submission of the dissertation, data will be
                                retained and securely disposed of in line with UCL's research data
                                management requirements.
                            </p>
                        </section>
                    </div>
                </Card>

                {/* Consent notice and action */}
                <Card className="border-amber-200 bg-amber-50">
                    <h2 className="font-semibold text-slate-900 mb-2">Important notice</h2>
                    <p className="text-sm text-slate-700 mb-4">
                        Consent is <strong>voluntary</strong> — you are under no obligation to participate.
                        However, consent is <strong>required</strong> to access the study materials and
                        complete the reconstruction exercise. If you do not wish to consent, you will not
                        be able to proceed and your account will not retain any data.
                    </p>
                    <label className="flex items-start gap-3 cursor-pointer mb-4">
                        <input
                            type="checkbox"
                            checked={agreed}
                            onChange={(e) => setAgreed(e.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-slate-300"
                        />
                        <span className="text-sm text-slate-700">
                            I have read and understood the Participant Information Sheet. I am 18 years of
                            age or over. I understand that my participation is voluntary and that I may
                            withdraw before submitting my final reconstruction. I agree to take part in
                            this research study.
                        </span>
                    </label>
                    <ErrorMessage message={error} />
                    <div className="flex gap-3">
                        <Button
                            onClick={handleConsent}
                            disabled={!agreed || submitting}
                        >
                            {submitting ? "Recording consent..." : "I consent — proceed to the study"}
                        </Button>
                        <Button variant="secondary" onClick={handleDecline}>
                            I do not consent — exit
                        </Button>
                    </div>
                </Card>

                <p className="text-center text-xs text-slate-400 pb-6">
                    UCL Research Ethics Committee Approval ID: 1330 · This page will not be shown again once you have consented.
                </p>
            </div>
        </div>
    );
}